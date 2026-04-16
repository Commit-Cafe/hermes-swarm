"use client"

import * as React from "react"
import { AgentChat } from "@/components/agent-chat"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  taskId?: string
  status?: string
}

type AgentSlot = {
  slotId: number
  name: string
  model: string
  provider: string
  messages: ChatMessage[]
  currentTaskId: string | null
  isRunning: boolean
}

const DEFAULT_SLOTS: AgentSlot[] = [
  { slotId: 1, name: "Agent 1", model: "", provider: "", messages: [], currentTaskId: null, isRunning: false },
  { slotId: 2, name: "Agent 2", model: "", provider: "", messages: [], currentTaskId: null, isRunning: false },
  { slotId: 3, name: "Agent 3", model: "", provider: "", messages: [], currentTaskId: null, isRunning: false },
  { slotId: 4, name: "Agent 4", model: "", provider: "", messages: [], currentTaskId: null, isRunning: false },
]

export default function WorkbenchPage() {
  const [slots, setSlots] = React.useState<AgentSlot[]>(DEFAULT_SLOTS)

  const updateSlot = React.useCallback((slotId: number, updatesOrFn: Partial<AgentSlot> | ((prev: AgentSlot) => Partial<AgentSlot>)) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.slotId !== slotId) return s
        const updates = typeof updatesOrFn === "function" ? updatesOrFn(s) : updatesOrFn
        return { ...s, ...updates }
      })
    )
  }, [])

  const runningCount = slots.filter((s) => s.isRunning).length

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
        <span className="text-sm font-medium text-foreground">Workbench</span>
        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
          {runningCount}/4
        </span>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 p-2 min-h-0 overflow-auto">
        {slots.map((slot) => (
          <AgentChat key={slot.slotId} slot={slot} onUpdateSlot={updateSlot} />
        ))}
      </div>
    </div>
  )
}
