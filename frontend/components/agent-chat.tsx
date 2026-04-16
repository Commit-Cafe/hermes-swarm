"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { useSSEEvent } from "@/lib/hooks"

const MODELS = [
  { value: "", label: "Default" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "openai/gpt-4.1", label: "GPT-4.1" },
  { value: "glm-5", label: "GLM-5" },
]

const PROVIDERS = [
  { value: "", label: "Auto" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "zai", label: "ZAI" },
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
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [slot.messages])

  const handleLogEvent = React.useCallback((event: any) => {
    if (!slot.currentTaskId || event.task_id !== slot.currentTaskId) return
    if (event.type !== "log") return
    if (event.stream === "stderr") return
    onUpdateSlot(slot.slotId, {
      messages: [
        ...slot.messages,
        {
          id: `log-${Date.now()}-${Math.random()}`,
          role: "assistant",
          content: event.content,
          timestamp: new Date().toISOString(),
          taskId: slot.currentTaskId,
        },
      ],
    })
  }, [slot.currentTaskId, slot.messages, slot.slotId, onUpdateSlot])

  useSSEEvent("log", handleLogEvent)

  const handleStatusEvent = React.useCallback((event: any) => {
    if (!slot.currentTaskId || event.task_id !== slot.currentTaskId) return
    if (event.type !== "status_changed") return
    if (event.status === "completed" || event.status === "failed") {
      onUpdateSlot(slot.slotId, {
        isRunning: false,
        messages: slot.messages.map((m) =>
          m.taskId === slot.currentTaskId && m.role === "assistant" && m.id.startsWith("streaming")
            ? { ...m, id: m.id.replace("streaming", "final"), status: event.status }
            : m
        ),
      })
    }
  }, [slot.currentTaskId, slot.messages, slot.slotId, onUpdateSlot])

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

  const statusDot = slot.isRunning
    ? "bg-green-400 animate-pulse"
    : slot.messages.length > 0
      ? "bg-gray-400"
      : "bg-gray-300"

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
          {editingName ? (
            <input
              className="bg-transparent text-sm font-medium border-b border-zinc-300 outline-none w-28"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
            />
          ) : (
            <span
              className="text-sm font-medium truncate cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300"
              onDoubleClick={() => { setEditingName(true); setNameDraft(slot.name) }}
              title="双击编辑名称"
            >
              {slot.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 hidden sm:block">
            {MODELS.find((m) => m.value === slot.model)?.label || "Default"}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 text-xs"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 space-y-2 bg-zinc-50/30 dark:bg-zinc-900/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 uppercase tracking-wide">Model</label>
              <select
                className="w-full h-7 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-1.5 mt-0.5"
                value={slot.model}
                onChange={(e) => { onUpdateSlot(slot.slotId, { model: e.target.value }); setShowSettings(false) }}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 uppercase tracking-wide">Provider</label>
              <select
                className="w-full h-7 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-1.5 mt-0.5"
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {slot.messages.length === 0 && !slot.isRunning && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg">
              🐝
            </div>
            <span>输入 prompt 开始工作</span>
          </div>
        )}
        {slot.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" && slot.isRunning ? (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>思考中...</span>
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
                    <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700 text-[10px] text-green-500">
                      ✓ 完成
                    </div>
                  )}
                  {msg.status === "failed" && (
                    <div className="mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700 text-[10px] text-red-400">
                      ✗ 失败
                    </div>
                  )}
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600 min-h-[36px] max-h-[100px] placeholder:text-zinc-400"
            placeholder={slot.isRunning ? "任务运行中..." : "输入 prompt... (Enter 发送)"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={slot.isRunning}
            rows={1}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || slot.isRunning}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 text-sm"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
