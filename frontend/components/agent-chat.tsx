"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"

const MODELS = [
  { value: "", label: "GLM-5-Turbo (Default)" },
  { value: "glm-5-turbo", label: "GLM-5-Turbo" },
  { value: "glm-5", label: "GLM-5" },
  { value: "glm-4-plus", label: "GLM-4-Plus" },
  { value: "glm-4-flash", label: "GLM-4-Flash" },
  { value: "glm-4-long", label: "GLM-4-Long" },
]

const PROVIDERS = [
  { value: "", label: "ZhipuAI" },
]

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

export function AgentChat({
  slot,
  onUpdateSlot,
}: {
  slot: AgentSlot
  onUpdateSlot: (id: number, updates: Partial<AgentSlot>) => void
}) {
  const [input, setInput] = React.useState("")
  const [editingName, setEditingName] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(slot.name)
  const [showSettings, setShowSettings] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const slotRef = React.useRef(slot)
  slotRef.current = slot
  const updateRef = React.useRef(onUpdateSlot)
  updateRef.current = onUpdateSlot

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [slot.messages.length])

  const handleLogEvent = React.useCallback((event: any) => {
    const s = slotRef.current
    if (!s.currentTaskId || event.task_id !== s.currentTaskId) return
    if (event.stream === "stderr") return
    updateRef.current(s.slotId, (prev: AgentSlot) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `log-${Date.now()}-${Math.random()}`,
          role: "assistant" as const,
          content: event.content,
          timestamp: new Date().toISOString(),
          taskId: s.currentTaskId!,
        },
      ],
    }))
  }, [])

  useSSEEvent("log", handleLogEvent)

  const handleStatusEvent = React.useCallback((event: any) => {
    const s = slotRef.current
    if (!s.currentTaskId || event.task_id !== s.currentTaskId) return
    if (event.status === "completed" || event.status === "failed") {
      updateRef.current(s.slotId, (prev: AgentSlot) => ({
        isRunning: false,
        messages: prev.messages.map((m) =>
          m.taskId === s.currentTaskId && m.role === "assistant" && m.id.startsWith("streaming")
            ? { ...m, id: m.id.replace("streaming", "final"), status: event.status }
            : m
        ),
      }))
    }
  }, [])

  useSSEEvent("status_changed", handleStatusEvent)

  const handleSubmit = async () => {
    const prompt = input.trim()
    if (!prompt || slot.isRunning) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    }

    const streamingMsg: ChatMessage = {
      id: `streaming-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    }

    const newMessages = [...slot.messages, userMsg, streamingMsg]
    onUpdateSlot(slot.slotId, { messages: newMessages, isRunning: true })
    setInput("")

    try {
      const result = await api.createTask({
        name: `${slot.name} - ${prompt.slice(0, 30)}`,
        prompt,
        model: slot.model || undefined,
        provider: slot.provider || undefined,
      })

      onUpdateSlot(slot.slotId, {
        currentTaskId: result.id,
        messages: newMessages.map((m) =>
          m.id === streamingMsg.id ? { ...m, taskId: result.id } : m
        ),
      })
    } catch (err) {
      onUpdateSlot(slot.slotId, {
        isRunning: false,
        messages: newMessages.map((m) =>
          m.id === streamingMsg.id ? { ...m, content: `Error: ${err}`, status: "failed" } : m
        ),
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const saveName = () => {
    onUpdateSlot(slot.slotId, { name: nameDraft || `Agent ${slot.slotId}` })
    setEditingName(false)
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${slot.isRunning ? "bg-foreground animate-pulse" : slot.messages.length > 0 ? "bg-muted-foreground" : "bg-border"}`} />
          {editingName ? (
            <input
              className="bg-transparent text-xs font-medium border-b border-border outline-none w-24"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
            />
          ) : (
            <span
              className="text-xs font-medium truncate cursor-pointer hover:text-muted-foreground transition-colors"
              onDoubleClick={() => { setEditingName(true); setNameDraft(slot.name) }}
              title="Double click to rename"
            >
              {slot.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground hidden sm:block font-mono">
            {MODELS.find((m) => m.value === slot.model)?.label || "Default"}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground text-[10px] transition-colors"
          >
            ⚙
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="px-3 py-2 border-b border-border space-y-1.5 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Model</label>
              <select
                className="w-full h-6 text-[11px] rounded border border-border bg-background px-1.5 mt-0.5"
                value={slot.model}
                onChange={(e) => { onUpdateSlot(slot.slotId, { model: e.target.value }); setShowSettings(false) }}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Provider</label>
              <select
                className="w-full h-6 text-[11px] rounded border border-border bg-background px-1.5 mt-0.5"
                value={slot.provider}
                onChange={(e) => { onUpdateSlot(slot.slotId, { provider: e.target.value }); setShowSettings(false) }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {slot.messages.length === 0 && !slot.isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-[11px] gap-1.5">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm">🐝</div>
            <span>Enter a prompt to start</span>
          </div>
        )}
        {slot.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" && slot.isRunning ? (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>thinking...</span>
                </div>
              ) : msg.role === "assistant" && msg.content ? (
                <div>
                  {msg.content.split("\n").map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < msg.content.split("\n").length - 1 && <br />}
                    </React.Fragment>
                  ))}
                  {msg.status === "completed" && (
                    <div className="mt-1 pt-1 border-t border-border text-[9px] text-muted-foreground">✓ done</div>
                  )}
                  {msg.status === "failed" && (
                    <div className="mt-1 pt-1 border-t border-border text-[9px] text-destructive">✗ failed</div>
                  )}
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex items-end gap-1.5">
          <textarea
            className="flex-1 resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring min-h-[32px] max-h-[80px] placeholder:text-muted-foreground"
            placeholder={slot.isRunning ? "Running..." : "Enter prompt..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={slot.isRunning}
            rows={1}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || slot.isRunning}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed shrink-0 text-xs"
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  )
}
