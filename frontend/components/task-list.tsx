"use client"

import * as React from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"

type Task = {
  id: string
  name: string
  prompt: string
  status: string
  model: string | null
  created_at: string
  duration_seconds: number | null
  error_message: string | null
}

const statusStyle: Record<string, string> = {
  running: "bg-foreground/10 text-foreground",
  completed: "bg-foreground text-background",
  failed: "bg-destructive/10 text-destructive",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
}

export function TaskList() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchTasks = React.useCallback(async () => {
    try {
      const data = await api.listTasks({ limit: 20 })
      setTasks(data)
    } catch (err) {
      console.error("Failed to fetch tasks:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchTasks() }, [fetchTasks])

  const onSSEEvent = React.useCallback(() => { fetchTasks() }, [fetchTasks])
  useSSEEvent("task_created", onSSEEvent)
  useSSEEvent("status_changed", onSSEEvent)
  useSSEEvent("task_finished", onSSEEvent)

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-6 text-center">
        No tasks yet
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/tasks/${task.id}`}
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors group"
        >
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 rounded font-mono ${statusStyle[task.status] || ""}`}>
            {task.status}
          </Badge>
          <span className="text-xs font-medium truncate flex-1">{task.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono hidden sm:block">
            {task.id.slice(0, 8)}
          </span>
          {task.duration_seconds != null && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {task.duration_seconds.toFixed(1)}s
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}
