"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Task = {
  id: string
  name: string
  prompt: string
  status: string
  model: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  exit_code: number | null
  result_preview: string | null
  error_message: string | null
}

function statusColor(status: string) {
  switch (status) {
    case "running": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "completed": return "bg-green-500/10 text-green-500 border-green-500/20"
    case "failed": return "bg-red-500/10 text-red-500 border-red-500/20"
    case "pending": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    case "cancelled": return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    default: return ""
  }
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

  React.useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  const handleCancel = async (taskId: string) => {
    try {
      await api.cancelTask(taskId)
      fetchTasks()
    } catch (err) {
      console.error("Failed to cancel task:", err)
    }
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading tasks...</div>
  }

  return (
    <div className="p-4 lg:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Tasks</h2>
        <Button variant="outline" size="sm" onClick={fetchTasks}>Refresh</Button>
      </div>
      {tasks.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No tasks yet. Create one from the Tasks page.
        </div>
      ) : (
        tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{task.name}</CardTitle>
                <Badge variant="outline" className={statusColor(task.status)}>
                  {task.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.prompt}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>ID: {task.id}</span>
                {task.model && <span>Model: {task.model}</span>}
                {task.duration_seconds != null && <span>Duration: {task.duration_seconds.toFixed(1)}s</span>}
                {task.status === "running" && (
                  <Button variant="destructive" size="sm" onClick={() => handleCancel(task.id)}>
                    Cancel
                  </Button>
                )}
              </div>
              {task.error_message && (
                <p className="text-xs text-red-500 mt-2 line-clamp-2">{task.error_message}</p>
              )}
              {task.result_preview && task.status === "completed" && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">View output</summary>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded-md overflow-auto max-h-40 whitespace-pre-wrap">
                    {task.result_preview}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
