"use client"

import * as React from "react"
import Link from "next/link"
import { AgentChat } from "@/components/agent-chat"

type AgentSlot = {
  slotId: number
  name: string
  model: string
  provider: string
  messages: {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: string
    taskId?: string
    status?: string
  }[]
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

  const updateSlot = React.useCallback((slotId: number, updates: Partial<AgentSlot>) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, ...updates } : s))
    )
  }, [])

  const runningCount = slots.filter((s) => s.isRunning).length

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight">Hermes Swarm</span>
          <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            {runningCount}/4 running
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/tasks"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Tasks
          </Link>
          <Link
            href="/logs"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Logs
          </Link>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 min-h-0 overflow-auto">
        {slots.map((slot) => (
          <AgentChat key={slot.slotId} slot={slot} onUpdateSlot={updateSlot} />
        ))}
      </div>
    </div>
  )
}
