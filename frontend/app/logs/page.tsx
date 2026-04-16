"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

type Task = {
  id: string
  name: string
  status: string
}

type LogEntry = {
  id: number
  task_id: string
  timestamp: string
  stream: string
  content: string
}

export default function LogsPage() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [selectedTask, setSelectedTask] = React.useState<string>("")
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    api.listTasks({ limit: 50 }).then(setTasks).catch(console.error)
  }, [])

  React.useEffect(() => {
    if (!selectedTask) return
    setLoading(true)
    api.getTaskLogs(selectedTask, { limit: 200 })
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedTask])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Task Logs</h1>

      <div className="flex items-center gap-4">
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
        >
          <option value="">Select a task...</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.id}) - {t.status}
            </option>
          ))}
        </select>
        {selectedTask && (
          <Button variant="outline" size="sm" onClick={() => {
            api.getTaskLogs(selectedTask, { limit: 200 }).then(setLogs)
          }}>
            Refresh
          </Button>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading logs...</div>}

      {!loading && selectedTask && logs.length === 0 && (
        <div className="text-sm text-muted-foreground">No logs found for this task.</div>
      )}

      {!loading && logs.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <pre className="text-xs overflow-auto max-h-[600px] whitespace-pre-wrap font-mono">
              {logs.map((log) => (
                <div key={log.id} className={log.stream === "stderr" ? "text-red-500" : ""}>
                  <span className="text-muted-foreground">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{" "}
                  {log.content}
                </div>
              ))}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
