"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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

  React.useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const onSSEEvent = React.useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  useSSEEvent("status_changed", onSSEEvent)
  useSSEEvent("task_created", onSSEEvent)
  useSSEEvent("task_finished", onSSEEvent)
  useSSEEvent("slot_acquired", onSSEEvent)

  if (loading) return <div className="p-6 text-muted-foreground">Loading agents...</div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agent Fleet</h1>
        <Button variant="outline" size="sm" onClick={fetchStatus}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status?.running ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Max Concurrent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{status?.max_concurrent ?? 4}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Active Processes</h2>
        {status && Object.keys(status.active_processes).length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No active agents running
          </div>
        ) : (
          status && Object.values(status.active_processes).map((proc) => (
            <Card key={proc.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{proc.name}</div>
                    <div className="text-xs text-muted-foreground">{proc.id}</div>
                  </div>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                    {proc.status}
                  </Badge>
                </div>
                {proc.started_at && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Started: {new Date(proc.started_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
