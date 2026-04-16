"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"
import { Badge } from "@/components/ui/badge"

type AgentStatus = {
  running: number
  max_concurrent: number
  active_processes: Record<string, {
    id: string
    name: string
    status: string
    started_at: string | null
  }>
}

export default function AgentsPage() {
  const [status, setStatus] = React.useState<AgentStatus | null>(null)
  const [loading, setLoading] = React.useState(true)

  const fetchStatus = React.useCallback(async () => {
    try {
      const data = await api.getAgentsStatus()
      setStatus(data)
    } catch (err) {
      console.error("Failed to fetch agents status:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchStatus() }, [fetchStatus])

  const onSSEEvent = React.useCallback(() => { fetchStatus() }, [fetchStatus])
  useSSEEvent("status_changed", onSSEEvent)
  useSSEEvent("task_created", onSSEEvent)
  useSSEEvent("task_finished", onSSEEvent)

  const procs = status ? Object.values(status.active_processes) : []

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Agents</h1>
        <p className="text-[11px] text-muted-foreground">Monitor running agent processes</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-2xl font-semibold tabular-nums">{status?.running ?? 0}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Running</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold tabular-nums text-muted-foreground">{status?.max_concurrent ?? 4}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Slots</div>
        </div>
        <div className="flex-1" />
        <div className="flex gap-0.5">
          {Array.from({ length: status?.max_concurrent ?? 4 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-6 rounded-sm ${i < (status?.running ?? 0) ? "bg-foreground" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Processes</h2>
        {procs.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">
            No active agents
          </div>
        ) : (
          <div className="space-y-1">
            {procs.map((proc) => (
              <div key={proc.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                <span className="text-xs font-medium flex-1 truncate">{proc.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{proc.id.slice(0, 8)}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded font-mono">
                  {proc.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
