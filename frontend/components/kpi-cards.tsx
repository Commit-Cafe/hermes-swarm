"use client"

import * as React from "react"
import { IconArrowDownRight, IconArrowUpRight } from "@tabler/icons-react"
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

  const items = loading ? [] : kpis

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {loading && (
        <div className="col-span-full text-sm text-muted-foreground px-2">Loading KPIs…</div>
      )}
      {!loading && items.map((m) => (
        <Card key={m.title} className="@container/card">
          <CardHeader>
            <CardDescription>{m.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatValue(m.title, m.value)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {m.changeType === 'increase' ? <IconArrowUpRight /> : <IconArrowDownRight />}
                {m.change > 0 ? `+${m.change}%` : `${m.change}%`}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">{m.description}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
