import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Callable, Awaitable

import httpx

from config import MAX_CONCURRENT_AGENTS, DEFAULT_TIMEOUT
from database import get_db
from models import TaskStatus

logger = logging.getLogger(__name__)

EventCallback = Callable[[str, dict], Awaitable[None]]

GLM_API_KEY = ""
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
GLM_MODEL = "glm-5-turbo"


def set_glm_config(api_key: str, base_url: str = None, model: str = None):
    global GLM_API_KEY, GLM_BASE_URL, GLM_MODEL
    if api_key:
        GLM_API_KEY = api_key
    if base_url:
        GLM_BASE_URL = base_url
    if model:
        GLM_MODEL = model


class AgentProcess:
    def __init__(self, task_id: str, name: str, prompt: str, **kwargs):
        self.task_id = task_id
        self.name = name
        self.prompt = prompt
        self.model = kwargs.get("model") or GLM_MODEL
        self.provider = kwargs.get("provider")
        self.skills = kwargs.get("skills")
        self.timeout = kwargs.get("timeout", DEFAULT_TIMEOUT)
        self.status = TaskStatus.PENDING
        self.started_at: Optional[datetime] = None
        self.finished_at: Optional[datetime] = None
        self.exit_code: Optional[int] = None
        self.stdout_lines: list[str] = []
        self.stderr_lines: list[str] = []
        self.token_count: int = 0
        self.cost_estimate: float = 0.0
        self.full_response: str = ""
        self._event_callbacks: list[EventCallback] = []
        self._cancelled = False

    def on_event(self, callback: EventCallback):
        self._event_callbacks.append(callback)

    async def _emit(self, event_type: str, data: dict):
        for cb in self._event_callbacks:
            try:
                await cb(self.task_id, {"type": event_type, **data})
            except Exception as e:
                logger.error(f"Event callback error: {e}")

    async def start(self):
        self.status = TaskStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

        await self._update_db_status(TaskStatus.RUNNING)
        await self._emit("status_changed", {"status": "running", "started_at": self.started_at.isoformat()})

        logger.info(f"Starting agent task {self.task_id} with model={self.model}")

        try:
            await self._call_llm()
        except asyncio.CancelledError:
            logger.info(f"Task {self.task_id} was cancelled")
            self.status = TaskStatus.CANCELLED
            self.finished_at = datetime.now(timezone.utc)
            await self._update_db_status(TaskStatus.CANCELLED)
            await self._emit("status_changed", {"status": "cancelled"})
        except Exception as e:
            logger.error(f"Task {self.task_id} error: {type(e).__name__}: {e!r}")
            self.status = TaskStatus.FAILED
            self.finished_at = datetime.now(timezone.utc)
            error_msg = str(e)
            self.stderr_lines.append(error_msg)
            await self._emit("log", {"stream": "stderr", "content": f"Error: {error_msg}"})
            await self._save_log("stderr", f"Error: {error_msg}")
            await self._update_db_status(TaskStatus.FAILED, error_message=error_msg)
            await self._emit("status_changed", {"status": "failed", "error": error_msg})

    async def _call_llm(self):
        api_key = GLM_API_KEY
        if not api_key:
            raise ValueError("GLM API Key not configured. Set GLM_API_KEY in .env")

        messages = [
            {"role": "system", "content": "You are a helpful AI assistant. Respond concisely and clearly."},
            {"role": "user", "content": self.prompt},
        ]

        url = f"{GLM_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
            "max_tokens": 4096,
        }

        timeout = httpx.Timeout(self.timeout, connect=30.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    error_msg = f"API returned {response.status_code}: {error_body.decode('utf-8', errors='replace')}"
                    raise RuntimeError(error_msg)

                buffer = ""
                async for line in response.aiter_lines():
                    if self._cancelled:
                        break

                    if not line.startswith("data:"):
                        continue

                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break

                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = data.get("choices", [])
                    if not choices:
                        continue

                    delta = choices[0].get("delta", {})
                    content = delta.get("content", "")

                    if content:
                        self.full_response += content
                        buffer += content

                        usage = data.get("usage", {})
                        if usage:
                            self.token_count = usage.get("total_tokens", self.token_count)

                        while "\n" in buffer:
                            line_text, buffer = buffer.split("\n", 1)
                            self.stdout_lines.append(line_text)
                            await self._emit("log", {"stream": "stdout", "content": line_text})
                            await self._save_log("stdout", line_text)

                if buffer:
                    self.stdout_lines.append(buffer)
                    await self._emit("log", {"stream": "stdout", "content": buffer})
                    await self._save_log("stdout", buffer)

        self.exit_code = 0
        self.status = TaskStatus.COMPLETED
        self.finished_at = datetime.now(timezone.utc)
        await self._update_db_status(TaskStatus.COMPLETED)
        await self._emit("status_changed", {"status": "completed", "exit_code": 0})

    async def cancel(self):
        self._cancelled = True
        self.status = TaskStatus.CANCELLED
        self.finished_at = datetime.now(timezone.utc)
        await self._update_db_status(TaskStatus.CANCELLED)
        await self._emit("status_changed", {"status": "cancelled"})

    async def _update_db_status(self, status: TaskStatus, error_message: str = None):
        db = await get_db()
        try:
            now = datetime.now(timezone.utc).isoformat()
            updates = ["status = ?"]
            values = [status.value]

            if status == TaskStatus.RUNNING:
                updates.append("started_at = ?")
                values.append(now)
            else:
                updates.append("finished_at = ?")
                values.append(now)

            if status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED):
                if self.started_at:
                    duration = (datetime.now(timezone.utc) - self.started_at).total_seconds()
                    updates.append("duration_seconds = ?")
                    values.append(duration)

                if self.stdout_lines:
                    preview = "\n".join(self.stdout_lines[-10:])
                    updates.append("result_preview = ?")
                    values.append(preview)

                if self.token_count:
                    updates.append("token_count = ?")
                    values.append(self.token_count)

            if error_message:
                updates.append("error_message = ?")
                values.append(error_message)

            values.append(self.task_id)
            await db.execute(
                f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
                values,
            )
            await db.commit()
        finally:
            await db.close()

    async def _save_log(self, stream: str, content: str):
        db = await get_db()
        try:
            now = datetime.now(timezone.utc).isoformat()
            await db.execute(
                "INSERT INTO task_logs (task_id, timestamp, stream, content) VALUES (?, ?, ?, ?)",
                (self.task_id, now, stream, content),
            )
            await db.commit()
        finally:
            await db.close()


class HermesSwarmManager:
    def __init__(self):
        self.processes: dict[str, AgentProcess] = {}
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_AGENTS)
        self._event_callbacks: list[EventCallback] = []
        self._tasks: dict[str, asyncio.Task] = {}

    def on_event(self, callback: EventCallback):
        self._event_callbacks.append(callback)

    async def _emit_global(self, event_type: str, data: dict):
        for cb in self._event_callbacks:
            try:
                await cb("__global__", {"type": event_type, **data})
            except Exception as e:
                logger.error(f"Global event callback error: {e}")

    async def create_task(self, name: str, prompt: str, **kwargs) -> str:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        process = AgentProcess(task_id, name, prompt, **kwargs)

        for cb in self._event_callbacks:
            process.on_event(cb)

        self.processes[task_id] = process

        db = await get_db()
        try:
            now = datetime.now(timezone.utc).isoformat()
            await db.execute(
                """INSERT INTO tasks (id, name, prompt, status, model, provider, skills, timeout, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (task_id, name, prompt, "pending",
                 kwargs.get("model"), kwargs.get("provider"), kwargs.get("skills"),
                 kwargs.get("timeout", DEFAULT_TIMEOUT), now),
            )
            await db.commit()
        finally:
            await db.close()

        await self._emit_global("task_created", {"task_id": task_id, "name": name})

        asyncio_task = asyncio.create_task(self._run_with_semaphore(process))
        self._tasks[task_id] = asyncio_task

        return task_id

    async def _run_with_semaphore(self, process: AgentProcess):
        async with self._semaphore:
            await self._emit_global("slot_acquired", {"task_id": process.task_id})
            await process.start()
            await self._emit_global("task_finished", {
                "task_id": process.task_id,
                "status": process.status.value,
            })

    async def cancel_task(self, task_id: str):
        if task_id in self.processes:
            process = self.processes[task_id]
            await process.cancel()
        if task_id in self._tasks:
            self._tasks[task_id].cancel()
            del self._tasks[task_id]

    async def get_running_count(self) -> int:
        return sum(1 for p in self.processes.values() if p.status == TaskStatus.RUNNING)

    async def get_task_status(self, task_id: str) -> Optional[dict]:
        if task_id in self.processes:
            p = self.processes[task_id]
            return {
                "id": p.task_id,
                "name": p.name,
                "status": p.status.value,
                "started_at": p.started_at.isoformat() if p.started_at else None,
                "exit_code": p.exit_code,
                "stdout_lines_count": len(p.stdout_lines),
                "stderr_lines_count": len(p.stderr_lines),
            }
        return None


swarm_manager = HermesSwarmManager()
