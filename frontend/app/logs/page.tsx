"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"

type Task = { id: string; name: string; status: string }

type LogEntry = { id: number; task_id: string; timestamp: string; stream: string; content: string }

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
        setLogs(data.map((log: any) => ({ ...log, id: nextLogId.current++ })))
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
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, autoScroll])

  const handleScroll = React.useCallback(() => {
    if (!logContainerRef.current) return
    const el = logContainerRef.current
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    if (atBottom !== autoScroll) setAutoScroll(atBottom)
  }, [autoScroll])

  const refreshTasks = React.useCallback(() => {
    api.listTasks({ limit: 50 }).then(setTasks).catch(console.error)
  }, [])
  useSSEEvent("task_created", refreshTasks)
  useSSEEvent("status_changed", refreshTasks)
  useSSEEvent("task_finished", refreshTasks)

  const filteredLogs = React.useMemo(() => {
    let result = logs
    if (streamFilter !== "all") result = result.filter((l) => l.stream === streamFilter)
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
      <div>
        <h1 className="text-sm font-semibold">Logs</h1>
        <p className="text-[11px] text-muted-foreground">View task output and error streams</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs min-w-[220px] font-mono"
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
        >
          <option value="">Select a task...</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.id.slice(0, 8)}) [{t.status}]
            </option>
          ))}
        </select>

        {selectedTask && (
          <>
            <div className="flex items-center gap-1">
              {(["all", "stdout", "stderr"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStreamFilter(s)}
                  className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${
                    streamFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s === "all" ? `all (${logs.length})` : s === "stdout" ? `out (${stdoutCount})` : `err (${stderrCount})`}
                </button>
              ))}
            </div>
            <input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-[160px] h-7 text-[11px] rounded-md border border-border bg-background px-2"
            />
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-2 py-1 text-[10px] rounded font-mono transition-colors ${
                  autoScroll ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {autoScroll ? "auto ↓" : "manual"}
              </button>
              <button
                onClick={() => {
                  nextLogId.current = 0
                  api.getTaskLogs(selectedTask, { limit: 500 }).then((data) => {
                    setLogs(data.map((log: any) => ({ ...log, id: nextLogId.current++ })))
                  })
                }}
                className="px-2 py-1 text-[10px] rounded bg-muted text-muted-foreground hover:bg-accent font-mono"
              >
                refresh
              </button>
            </div>
          </>
        )}
      </div>

      {loading && <div className="text-xs text-muted-foreground">Loading...</div>}

      {!loading && selectedTask && logs.length === 0 && (
        <div className="text-xs text-muted-foreground py-4 text-center">No logs found</div>
      )}

      {!loading && filteredLogs.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="overflow-auto max-h-[600px] bg-card"
          >
            <pre className="text-[11px] whitespace-pre-wrap font-mono p-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className={`${log.stream === "stderr" ? "text-destructive" : ""} leading-relaxed`}>
                  <span className="text-muted-foreground">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{" "}
                  {log.content}
                </div>
              ))}
              <div ref={logEndRef} />
            </pre>
          </div>
          <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground font-mono">
            {filteredLogs.length}/{logs.length} entries
          </div>
        </div>
      )}
    </div>
  )
}
