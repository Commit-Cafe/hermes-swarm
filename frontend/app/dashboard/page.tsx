"use client"

import * as React from "react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { KPICards } from "@/components/kpi-cards"
import { TaskList } from "@/components/task-list"
import { defaultFilters, type Filters } from "@/lib/analytics"

export default function Page() {
  const [filters] = React.useState<Filters>(defaultFilters)

  return (
    <>
      <KPICards filters={filters} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <TaskList />
    </>
  )
}
