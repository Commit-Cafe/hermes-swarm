"use client"

import * as React from "react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { KPICards } from "@/components/kpi-cards"
import { TaskList } from "@/components/task-list"
import { defaultFilters, type Filters } from "@/lib/analytics"

export default function Page() {
  const [filters] = React.useState<Filters>(defaultFilters)

  return (
    <div className="space-y-4 pb-6">
      <div className="px-4 lg:px-6 pt-2">
        <h1 className="text-sm font-semibold">Dashboard</h1>
        <p className="text-[11px] text-muted-foreground">Overview of your swarm activity</p>
      </div>
      <KPICards filters={filters} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Tasks</h2>
        </div>
        <TaskList />
      </div>
    </div>
  )
}
