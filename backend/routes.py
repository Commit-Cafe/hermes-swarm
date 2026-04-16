import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from models import (
    TaskCreate, TaskResponse, TaskStatus, TaskLogEntry,
    DashboardKPI, DashboardKPIsResponse, SeriesPoint, MetricsSeriesResponse,
    BatchTaskCreate,
)
from database import get_db
from config import DEFAULT_TIMEOUT
from hermes_manager import swarm_manager

logger = logging.getLogger(__name__)
router = APIRouter()


def _row_to_task_response(row) -> TaskResponse:
    return TaskResponse(
        id=row["id"],
        name=row["name"],
        prompt=row["prompt"],
        status=TaskStatus(row["status"]),
        model=row["model"],
        provider=row["provider"],
        skills=row["skills"],
        timeout=row["timeout"],
        created_at=row["created_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        duration_seconds=row["duration_seconds"],
        exit_code=row["exit_code"],
        result_preview=row["result_preview"],
        error_message=row["error_message"],
        token_count=row["token_count"],
        cost_estimate=row["cost_estimate"],
    )


@router.post("/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    strategy = task.strategy
    strategy_count = task.strategy_count or 3

    if strategy == "best-of-n":
        task_ids = []
        for i in range(strategy_count):
            tid = await swarm_manager.create_task(
                name=f"{task.name} [best-of-n:{i+1}/{strategy_count}]",
                prompt=task.prompt,
                model=task.model,
                provider=task.provider,
                skills=task.skills,
                timeout=task.timeout or DEFAULT_TIMEOUT,
            )
            task_ids.append(tid)
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_ids[0],))
            row = await cursor.fetchone()
            if row:
                return _row_to_task_response(row)
        finally:
            await db.close()
        raise HTTPException(status_code=500, detail="Failed to create best-of-n tasks")

    elif strategy == "iterative":
        parent_id = await swarm_manager.create_task(
            name=f"{task.name} [iterative:1/{strategy_count}]",
            prompt=task.prompt,
            model=task.model,
            provider=task.provider,
            skills=task.skills,
            timeout=task.timeout or DEFAULT_TIMEOUT,
        )
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (parent_id,))
            row = await cursor.fetchone()
            if row:
                return _row_to_task_response(row)
        finally:
            await db.close()
        raise HTTPException(status_code=500, detail="Failed to create iterative task")

    else:
        task_id = await swarm_manager.create_task(
            name=task.name,
            prompt=task.prompt,
            model=task.model,
            provider=task.provider,
            skills=task.skills,
            timeout=task.timeout or DEFAULT_TIMEOUT,
        )
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            row = await cursor.fetchone()
            if row:
                return _row_to_task_response(row)
            raise HTTPException(status_code=404, detail="Task not found after creation")
        finally:
            await db.close()


@router.post("/tasks/batch", response_model=list[TaskResponse])
async def create_batch_tasks(batch: BatchTaskCreate):
    results = []
    for task in batch.tasks:
        task_id = await swarm_manager.create_task(
            name=task.name,
            prompt=task.prompt,
            model=task.model,
            provider=task.provider,
            skills=task.skills,
            timeout=task.timeout or DEFAULT_TIMEOUT,
        )
        db = await get_db()
        try:
            cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            row = await cursor.fetchone()
            if row:
                results.append(_row_to_task_response(row))
        finally:
            await db.close()
    return results


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    db = await get_db()
    try:
        if status:
            cursor = await db.execute(
                "SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (status, limit, offset),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
        rows = await cursor.fetchall()
        return [_row_to_task_response(row) for row in rows]
    finally:
        await db.close()


@router.get("/tasks/stream")
async def stream_events():
    queue = asyncio.Queue()

    async def on_event(task_id: str, event: dict):
        event["task_id"] = task_id
        await queue.put(event)

    swarm_manager.on_event(on_event)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return _row_to_task_response(row)
    finally:
        await db.close()


@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    await swarm_manager.cancel_task(task_id)
    return {"status": "cancelled", "task_id": task_id}


@router.get("/tasks/{task_id}/logs", response_model=list[TaskLogEntry])
async def get_task_logs(
    task_id: str,
    stream: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    db = await get_db()
    try:
        if stream:
            cursor = await db.execute(
                "SELECT * FROM task_logs WHERE task_id = ? AND stream = ? ORDER BY id DESC LIMIT ?",
                (task_id, stream, limit),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM task_logs WHERE task_id = ? ORDER BY id DESC LIMIT ?",
                (task_id, limit),
            )
        rows = await cursor.fetchall()
        return [
            TaskLogEntry(
                id=row["id"],
                task_id=row["task_id"],
                timestamp=row["timestamp"],
                stream=row["stream"],
                content=row["content"],
            )
            for row in reversed(list(rows))
        ]
    finally:
        await db.close()


@router.get("/dashboard/kpis", response_model=DashboardKPIsResponse)
async def get_kpis(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    db = await get_db()
    try:
        now = datetime.now(timezone.utc)
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")
        if not start_date:
            start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")

        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM tasks WHERE created_at >= ? || 'T00:00:00' AND created_at <= ? || 'T23:59:59'",
            (start_date, end_date),
        )
        total_row = await cursor.fetchone()
        total = total_row["cnt"] if total_row else 0

        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'completed' AND created_at >= ? || 'T00:00:00' AND created_at <= ? || 'T23:59:59'",
            (start_date, end_date),
        )
        completed_row = await cursor.fetchone()
        completed = completed_row["cnt"] if completed_row else 0

        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'failed' AND created_at >= ? || 'T00:00:00' AND created_at <= ? || 'T23:59:59'",
            (start_date, end_date),
        )
        failed_row = await cursor.fetchone()
        failed = failed_row["cnt"] if failed_row else 0

        cursor = await db.execute(
            "SELECT AVG(duration_seconds) as avg_d FROM tasks WHERE status = 'completed' AND duration_seconds IS NOT NULL AND created_at >= ? || 'T00:00:00' AND created_at <= ? || 'T23:59:59'",
            (start_date, end_date),
        )
        avg_row = await cursor.fetchone()
        avg_duration = avg_row["avg_d"] if avg_row and avg_row["avg_d"] else 0

        cursor = await db.execute(
            "SELECT SUM(COALESCE(token_count, 0)) as total_tokens FROM tasks WHERE created_at >= ? || 'T00:00:00' AND created_at <= ? || 'T23:59:59'",
            (start_date, end_date),
        )
        token_row = await cursor.fetchone()
        total_tokens = token_row["total_tokens"] if token_row and token_row["total_tokens"] else 0

        running = await swarm_manager.get_running_count()

        kpis = [
            DashboardKPI(title="Total Tasks", value=total, change=0, change_type="increase", description="All tasks in period"),
            DashboardKPI(title="Completed", value=completed, change=0, change_type="increase", description="Successfully completed"),
            DashboardKPI(title="Failed", value=failed, change=0, change_type="increase", description="Tasks that failed"),
            DashboardKPI(title="Running Now", value=running, change=0, change_type="increase", description="Currently active agents"),
            DashboardKPI(title="Avg Duration", value=round(avg_duration, 1), change=0, change_type="decrease", description="Average completion time (s)"),
            DashboardKPI(title="Tokens Used", value=total_tokens, change=0, change_type="increase", description="Total tokens processed"),
        ]

        return DashboardKPIsResponse(kpis=kpis)
    finally:
        await db.close()


@router.get("/dashboard/series", response_model=MetricsSeriesResponse)
async def get_metrics_series(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    db = await get_db()
    try:
        now = datetime.now(timezone.utc)
        if not end_date:
            end_date = now.strftime("%Y-%m-%d")
        if not start_date:
            start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")

        cursor = await db.execute(
            """SELECT DATE(created_at) as date,
                      COUNT(*) as tasks,
                      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
                      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
                      SUM(COALESCE(token_count, 0)) as tokens
               FROM tasks
               WHERE created_at >= ? || 'T00:00:00' AND created_at <= ? || 'T23:59:59'
               GROUP BY DATE(created_at)
               ORDER BY date""",
            (start_date, end_date),
        )
        rows = await cursor.fetchall()

        items = [
            SeriesPoint(
                date=row["date"],
                tasks=row["tasks"],
                completed=row["completed"],
                failed=row["failed"],
                tokens=row["tokens"],
            )
            for row in rows
        ]

        return MetricsSeriesResponse(start_date=start_date, end_date=end_date, items=items)
    finally:
        await db.close()


@router.get("/agents/status")
async def get_agents_status():
    running_count = await swarm_manager.get_running_count()
    all_processes = {
        tid: {
            "id": p.task_id,
            "name": p.name,
            "status": p.status.value,
            "started_at": p.started_at.isoformat() if p.started_at else None,
        }
        for tid, p in swarm_manager.processes.items()
        if p.status in (TaskStatus.RUNNING, TaskStatus.PENDING)
    }
    return {
        "running": running_count,
        "max_concurrent": 4,
        "active_processes": all_processes,
    }
