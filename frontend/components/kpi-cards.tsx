"use client"

import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { type Filters } from "@/lib/analytics"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"

type KPI = { title: string; value: number; change: number; changeType: 'increase' | 'decrease'; description?: string }

function formatValue(title: string, v: number): string {
  const abbreviate = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
    return String(Math.round(n))
  }
  if (title.toLowerCase().includes("duration")) return `${v.toFixed(1)}s`
  if (title.toLowerCase().includes("latency")) return `${Math.round(v)}ms`
  if (title.toLowerCase().includes("error")) return `${v.toFixed(2)}%`
  return abbreviate(v)
}

export function KPICards({ filters }: { filters: Filters }) {
  const [kpis, setKpis] = React.useState<KPI[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshKey, setRefreshKey] = React.useState(0)

  React.useEffect(() => {
    const now = new Date()
    let start = new Date(now)
    switch (filters.timeRange) {
      case '1h': start = new Date(now.getTime() - 60 * 60 * 1000); break
      case '7d': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case '30d': start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
      default: start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    const startDate = (filters.startDate ?? start.toISOString().slice(0, 10))
    const endDate = (filters.endDate ?? now.toISOString().slice(0, 10))

    setLoading(true)
    api.getKPIs({ startDate, endDate }).then((res) => {
      const mapped: KPI[] = (res.kpis || []).map((k: any) => ({
        title: k.title,
        value: Number(k.value || 0),
        change: Number(k.change || 0),
        changeType: k.change_type === 'increase' ? 'increase' : 'decrease',
        description: k.description,
      }))
      setKpis(mapped)
    }).finally(() => setLoading(false))
  }, [filters.timeRange, filters.startDate, filters.endDate, filters.agents?.join(','), refreshKey])

  const onSSEEvent = React.useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useSSEEvent("status_changed", onSSEEvent)
  useSSEEvent("task_created", onSSEEvent)
  useSSEEvent("task_finished", onSSEEvent)

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 px-4 lg:px-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="p-4">
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-6 w-12 bg-muted rounded mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 px-4 lg:px-6">
      {kpis.map((m) => (
        <Card key={m.title} className="py-0">
          <CardHeader className="p-4 pb-3">
            <CardDescription className="text-[10px] uppercase tracking-wider">{m.title}</CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums tracking-tight">
              {formatValue(m.title, m.value)}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
