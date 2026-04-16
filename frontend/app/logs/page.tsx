"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

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
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [streamFilter, setStreamFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const logEndRef = React.useRef<HTMLDivElement>(null)
  const logContainerRef = React.useRef<HTMLDivElement>(null)
  const nextLogId = React.useRef(0)

  React.useEffect(() => {
    api.listTasks({ limit: 50 }).then(setTasks).catch(console.error)
  }, [])

  React.useEffect(() => {
    if (!selectedTask) return
    setLoading(true)
    setLogs([])
    nextLogId.current = 0
    api.getTaskLogs(selectedTask, { limit: 500 })
      .then((data) => {
        const withIds = data.map((log: any) => ({
          ...log,
          id: nextLogId.current++,
        }))
        setLogs(withIds)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedTask])

  const handleLogEvent = React.useCallback((event: any) => {
    if (!selectedTask || event.task_id !== selectedTask) return
    if (event.type !== "log") return
    setLogs((prev) => [...prev, {
      id: nextLogId.current++,
      task_id: event.task_id,
      timestamp: new Date().toISOString(),
      stream: event.stream,
      content: event.content,
    }])
  }, [selectedTask])

  useSSEEvent("log", handleLogEvent)

  React.useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, autoScroll])

  const handleScroll = React.useCallback(() => {
    if (!logContainerRef.current) return
    const el = logContainerRef.current
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    if (atBottom !== autoScroll) {
      setAutoScroll(atBottom)
    }
  }, [autoScroll])

  const refreshTasks = React.useCallback(() => {
    api.listTasks({ limit: 50 }).then(setTasks).catch(console.error)
  }, [])
  useSSEEvent("task_created", refreshTasks)
  useSSEEvent("status_changed", refreshTasks)
  useSSEEvent("task_finished", refreshTasks)

  const filteredLogs = React.useMemo(() => {
    let result = logs
    if (streamFilter !== "all") {
      result = result.filter((l) => l.stream === streamFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((l) => l.content.toLowerCase().includes(q))
    }
    return result
  }, [logs, streamFilter, searchQuery])

  const stdoutCount = logs.filter((l) => l.stream === "stdout").length
  const stderrCount = logs.filter((l) => l.stream === "stderr").length

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Task Logs</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[250px]"
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
          <>
            <div className="flex items-center gap-1">
              <Button
                variant={streamFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStreamFilter("all")}
              >
                All ({logs.length})
              </Button>
              <Button
                variant={streamFilter === "stdout" ? "default" : "outline"}
                size="sm"
                onClick={() => setStreamFilter("stdout")}
              >
                stdout ({stdoutCount})
              </Button>
              <Button
                variant={streamFilter === "stderr" ? "default" : "outline"}
                size="sm"
                onClick={() => setStreamFilter("stderr")}
              >
                stderr ({stderrCount})
              </Button>
            </div>

            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-[200px]"
            />

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={autoScroll ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
              >
                {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                nextLogId.current = 0
                api.getTaskLogs(selectedTask, { limit: 500 }).then((data) => {
                  const withIds = data.map((log: any) => ({
                    ...log,
                    id: nextLogId.current++,
                  }))
                  setLogs(withIds)
                })
              }}>
                Refresh
              </Button>
            </div>
          </>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading logs...</div>}

      {!loading && selectedTask && logs.length === 0 && (
        <div className="text-sm text-muted-foreground">No logs found for this task.</div>
      )}

      {!loading && filteredLogs.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div
              ref={logContainerRef}
              onScroll={handleScroll}
              className="overflow-auto max-h-[600px]"
            >
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {filteredLogs.map((log) => (
                  <div key={log.id} className={log.stream === "stderr" ? "text-red-500" : ""}>
                    <span className="text-muted-foreground">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>{" "}
                    {log.content}
                  </div>
                ))}
                <div ref={logEndRef} />
              </pre>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} log entries
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
