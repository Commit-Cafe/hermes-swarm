"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type TaskDetail = {
  id: string
  name: string
  prompt: string
  status: string
  model: string | null
  provider: string | null
  skills: string | null
  timeout: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  exit_code: number | null
  result_preview: string | null
  error_message: string | null
  token_count: number
  cost_estimate: number
}

type LogEntry = {
  id: number
  timestamp: string
  stream: string
  content: string
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

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [task, setTask] = React.useState<TaskDetail | null>(null)
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)

  React.useEffect(() => {
    if (!taskId) return
    setLoading(true)
    Promise.all([
      api.getTask(taskId),
      api.getTaskLogs(taskId, { limit: 500 }),
    ]).then(([t, l]) => {
      setTask(t)
      setLogs(l)
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [taskId, refreshKey])

  const onSSEEvent = React.useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [taskId])

  useSSEEvent("status_changed", onSSEEvent)
  useSSEEvent("task_finished", onSSEEvent)

  const handleExportJSON = () => {
    if (!task) return
    downloadFile(
      `${task.name || task.id}.json`,
      JSON.stringify({ task, logs }, null, 2),
      "application/json"
    )
  }

  const handleExportCSV = () => {
    if (!task) return
    const header = "id,name,status,model,created_at,duration_seconds,token_count,prompt\n"
    const row = `"${task.id}","${task.name}","${task.status}","${task.model || ""}","${task.created_at}",${task.duration_seconds || ""},${task.token_count},"${task.prompt.replace(/"/g, '""')}"\n`
    downloadFile(`${task.name || task.id}.csv`, header + row, "text/csv")
  }

  const handleExportMarkdown = () => {
    if (!task) return
    let md = `# ${task.name}\n\n`
    md += `- **Status**: ${task.status}\n`
    md += `- **Model**: ${task.model || "default"}\n`
    md += `- **Provider**: ${task.provider || "auto"}\n`
    md += `- **Created**: ${task.created_at}\n`
    md += `- **Duration**: ${task.duration_seconds?.toFixed(1) || "N/A"}s\n`
    md += `- **Tokens**: ${task.token_count}\n\n`
    md += `## Prompt\n\n\`\`\`\n${task.prompt}\n\`\`\`\n\n`
    if (task.result_preview) {
      md += `## Result\n\n\`\`\`\n${task.result_preview}\n\`\`\`\n\n`
    }
    if (task.error_message) {
      md += `## Error\n\n\`\`\`\n${task.error_message}\n\`\`\`\n\n`
    }
    if (logs.length > 0) {
      md += `## Logs\n\n`
      logs.forEach((l) => {
        md += `- **[${new Date(l.timestamp).toLocaleTimeString()}] (${l.stream})**: ${l.content}\n`
      })
    }
    downloadFile(`${task.name || task.id}.md`, md, "text/markdown")
  }

  const handleCancel = async () => {
    if (!task) return
    await api.cancelTask(task.id)
    setRefreshKey((k) => k + 1)
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading task...</div>
  if (!task) return <div className="p-6 text-muted-foreground">Task not found</div>

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>&larr; Back</Button>
          <h1 className="text-xl font-semibold">{task.name}</h1>
          <Badge variant="outline" className={statusColor(task.status)}>{task.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>JSON</Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportMarkdown}>Markdown</Button>
          {task.status === "running" && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>Cancel</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: "ID", value: task.id },
          { label: "Model", value: task.model || "default" },
          { label: "Provider", value: task.provider || "auto" },
          { label: "Duration", value: task.duration_seconds ? `${task.duration_seconds.toFixed(1)}s` : "N/A" },
          { label: "Tokens", value: String(task.token_count) },
          { label: "Exit Code", value: task.exit_code != null ? String(task.exit_code) : "N/A" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-medium truncate">{item.value}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{task.prompt}</pre>
        </CardContent>
      </Card>

      {task.error_message && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap bg-red-500/5 text-red-500 p-3 rounded-md">{task.error_message}</pre>
          </CardContent>
        </Card>
      )}

      {task.result_preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Result Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[300px] overflow-auto">{task.result_preview}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Logs ({logs.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
            {logs.map((log) => (
              <div key={log.id} className={log.stream === "stderr" ? "text-red-500" : ""}>
                <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                {log.content}
              </div>
            ))}
            {logs.length === 0 && <span className="text-muted-foreground">No logs available</span>}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
