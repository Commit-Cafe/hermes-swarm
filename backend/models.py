from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskCreate(BaseModel):
    name: str
    prompt: str
    model: Optional[str] = None
    provider: Optional[str] = None
    skills: Optional[str] = None
    timeout: Optional[int] = None


class TaskResponse(BaseModel):
    id: str
    name: str
    prompt: str
    status: TaskStatus
    model: Optional[str] = None
    provider: Optional[str] = None
    skills: Optional[str] = None
    timeout: int
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    exit_code: Optional[int] = None
    result_preview: Optional[str] = None
    error_message: Optional[str] = None
    token_count: Optional[int] = None
    cost_estimate: Optional[float] = None


class TaskLogEntry(BaseModel):
    id: int
    task_id: str
    timestamp: str
    stream: str
    content: str


class DashboardKPI(BaseModel):
    title: str
    value: float
    change: float
    change_type: str
    description: Optional[str] = None


class DashboardKPIsResponse(BaseModel):
    kpis: list[DashboardKPI]


class SeriesPoint(BaseModel):
    date: str
    tasks: int
    completed: int
    failed: int
    tokens: int = 0


class MetricsSeriesResponse(BaseModel):
    start_date: str
    end_date: str
    items: list[SeriesPoint]
