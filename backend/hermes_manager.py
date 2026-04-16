import asyncio
import base64
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Callable, Awaitable

from config import WSL_VENV_ACTIVATE, WSL_HERMES_CMD, MAX_CONCURRENT_AGENTS, DEFAULT_TIMEOUT
from database import get_db
from models import TaskStatus

logger = logging.getLogger(__name__)

EventCallback = Callable[[str, dict], Awaitable[None]]


def parse_summary_line(lines: list[str]) -> dict:
    result = {"duration_seconds": None, "message_count": None, "session_id": None}
    for line in lines:
        line = line.strip()
        m = re.match(r"Session:\s+(\S+)", line)
        if m:
            result["session_id"] = m.group(1)
        m = re.match(r"Duration:\s+(\d+\.?\d*)\s*(\w+)", line)
        if m:
            val = float(m.group(1))
            unit = m.group(2).lower()
            if unit.startswith("min"):
                val *= 60
            elif unit.startswith("h"):
                val *= 3600
            result["duration_seconds"] = val
        m = re.match(r"Messages:\s+(\d+)", line)
        if m:
            result["message_count"] = int(m.group(1))
    return result


async def read_session_token_stats(session_id: str) -> dict:
    session_dir = Path("/root/.hermes/sessions")
    session_file = session_dir / f"session_{session_id}.json"
    if not session_file.exists():
        return {}
    try:
        import aiofiles
        async with aiofiles.open(session_file, "r") as f:
            data = json.loads(await f.read())
    except ImportError:
        with open(session_file, "r") as f:
            data = json.load(f)
    except Exception as e:
        logger.debug(f"Failed to read session file {session_id}: {e}")
        return {}

    token_count = data.get("total_tokens", 0)
    messages = data.get("messages", [])
    if not token_count and messages:
        for msg in messages:
            usage = msg.get("usage", {})
            if usage:
                token_count += usage.get("total_tokens", 0)
    return {"token_count": token_count, "message_count": len(messages)}


class HermesProcess:
    def __init__(self, task_id: str, name: str, prompt: str, **kwargs):
        self.task_id = task_id
        self.name = name
        self.prompt = prompt
        self.model = kwargs.get("model")
        self.provider = kwargs.get("provider")
        self.skills = kwargs.get("skills")
        self.timeout = kwargs.get("timeout", DEFAULT_TIMEOUT)
        self.process: Optional[asyncio.subprocess.Process] = None
        self.status = TaskStatus.PENDING
        self.started_at: Optional[datetime] = None
        self.finished_at: Optional[datetime] = None
        self.exit_code: Optional[int] = None
        self.stdout_lines: list[str] = []
        self.stderr_lines: list[str] = []
        self.token_count: int = 0
        self.cost_estimate: float = 0.0
        self._event_callbacks: list[EventCallback] = []

    def on_event(self, callback: EventCallback):
        self._event_callbacks.append(callback)

    async def _emit(self, event_type: str, data: dict):
        for cb in self._event_callbacks:
            try:
                await cb(self.task_id, {"type": event_type, **data})
            except Exception as e:
                logger.error(f"Event callback error: {e}")

    def _build_wsl_command(self) -> list[str]:
        encoded_prompt = base64.b64encode(self.prompt.encode("utf-8")).decode("ascii")
        prompt_arg = f"\"$(echo '{encoded_prompt}' | base64 -d)\""

        extra_flags = ""
        if self.model:
            extra_flags += f" -m {self.model}"
        if self.provider:
            extra_flags += f" --provider {self.provider}"
        if self.skills:
            extra_flags += f" -s {self.skills}"

        return ["wsl", "bash", "-c", f"source {WSL_VENV_ACTIVATE} && cd /root/hermes-agent && hermes chat -q {prompt_arg} -Q{extra_flags}"]

    async def start(self):
        self.status = TaskStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

        await self._update_db_status(TaskStatus.RUNNING)
        await self._emit("status_changed", {"status": "running", "started_at": self.started_at.isoformat()})

        cmd = self._build_wsl_command()
        logger.info(f"Starting hermes task {self.task_id}: {' '.join(cmd)[:200]}")

        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            await self._emit("process_started", {"pid": self.process.pid})

            try:
                await asyncio.wait_for(self._read_output(), timeout=self.timeout)
            except asyncio.TimeoutError:
                logger.warning(f"Task {self.task_id} timed out after {self.timeout}s")
                await self.cancel()
                await self._update_db_status(TaskStatus.FAILED, error_message=f"Timeout after {self.timeout}s")
                await self._emit("status_changed", {"status": "failed", "error": "timeout"})
                return

            try:
                await asyncio.wait_for(self.process.wait(), timeout=10)
            except asyncio.TimeoutError:
                logger.warning(f"Task {self.task_id}: process did not exit after streams closed")

            self.exit_code = self.process.returncode
            self.finished_at = datetime.now(timezone.utc)

            summary = parse_summary_line(self.stdout_lines)
            session_id = summary.get("session_id")
            if session_id:
                try:
                    stats = await read_session_token_stats(session_id)
                    if stats.get("token_count"):
                        self.token_count = stats["token_count"]
                except Exception as e:
                    logger.debug(f"Failed to read session token stats: {e}")

            if self.exit_code is None or self.exit_code == 0:
                self.status = TaskStatus.COMPLETED
                await self._update_db_status(TaskStatus.COMPLETED)
                await self._emit("status_changed", {"status": "completed", "exit_code": self.exit_code or 0})
            else:
                self.status = TaskStatus.FAILED
                error_msg = "\n".join(self.stderr_lines[-5:]) if self.stderr_lines else f"Exit code: {self.exit_code}"
                await self._update_db_status(TaskStatus.FAILED, error_message=error_msg)
                await self._emit("status_changed", {"status": "failed", "exit_code": self.exit_code})

        except Exception as e:
            logger.error(f"Task {self.task_id} error: {type(e).__name__}: {e!r}")
            self.status = TaskStatus.FAILED
            self.finished_at = datetime.now(timezone.utc)
            await self._update_db_status(TaskStatus.FAILED, error_message=str(e))
            await self._emit("status_changed", {"status": "failed", "error": str(e)})

    async def _read_output(self):
        async def read_stream(stream, stream_name):
            while True:
                line = await stream.readline()
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if stream_name == "stdout":
                    self.stdout_lines.append(decoded)
                else:
                    self.stderr_lines.append(decoded)
                await self._emit("log", {"stream": stream_name, "content": decoded})
                await self._save_log(stream_name, decoded)

        await asyncio.gather(
            read_stream(self.process.stdout, "stdout"),
            read_stream(self.process.stderr, "stderr"),
        )

    async def cancel(self):
        if self.process and self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.process.kill()
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
                if self.cost_estimate:
                    updates.append("cost_estimate = ?")
                    values.append(self.cost_estimate)

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
        self.processes: dict[str, HermesProcess] = {}
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
        process = HermesProcess(task_id, name, prompt, **kwargs)

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

    async def _run_with_semaphore(self, process: HermesProcess):
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
