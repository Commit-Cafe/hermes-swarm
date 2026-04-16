"use client"

import * as React from "react"
import { api } from "@/lib/api"

export interface TaskInfo {
  id: string
  name: string
  status: string
  prompt: string
  model: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  exit_code: number | null
  result_preview: string | null
  error_message: string | null
}

export function useTasks(options?: { status?: string; limit?: number }) {
  const [tasks, setTasks] = React.useState<TaskInfo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const fetchTasks = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.listTasks({
        status: options?.status,
        limit: options?.limit || 50,
      })
      setTasks(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch tasks"))
    } finally {
      setLoading(false)
    }
  }, [options?.status, options?.limit])

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return { tasks, setTasks, loading, error, refetch: fetchTasks }
}

const SSE_CTX = React.createContext<{
  connected: boolean
  subscribe: (eventType: string, handler: (data: any) => void) => () => void
} | null>(null)

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = React.useState(false)
  const handlersRef = React.useRef<Map<string, Set<(data: any) => void>>>(new Map())
  const esRef = React.useRef<EventSource | null>(null)
  const retryRef = React.useRef(0)

  const subscribe = React.useCallback((eventType: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set())
    }
    handlersRef.current.get(eventType)!.add(handler)
    return () => {
      handlersRef.current.get(eventType)?.delete(handler)
    }
  }, [])

  const dispatch = React.useCallback((event: any) => {
    const type: string = event.type
    const handlers = handlersRef.current.get(type)
    if (handlers) {
      handlers.forEach((h) => {
        try { h(event) } catch {}
      })
    }
    const allHandlers = handlersRef.current.get("*")
    if (allHandlers) {
      allHandlers.forEach((h) => {
        try { h(event) } catch {}
      })
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return
      const url = api.getEventStreamUrl()
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => {
        if (cancelled) return
        setConnected(true)
        retryRef.current = 0
      }

      es.onmessage = (e) => {
        if (cancelled) return
        try {
          const data = JSON.parse(e.data)
          if (data.type !== "heartbeat") {
            dispatch(data)
          }
        } catch {}
      }

      es.onerror = () => {
        if (cancelled) return
        setConnected(false)
        es.close()
        esRef.current = null
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000)
        retryRef.current++
        setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      esRef.current?.close()
      esRef.current = null
    }
  }, [dispatch])

  const value = React.useMemo(() => ({ connected, subscribe }), [connected, subscribe])

  return <SSE_CTX.Provider value={value}>{children}</SSE_CTX.Provider>
}

export function useSSE() {
  const ctx = React.useContext(SSE_CTX)
  if (!ctx) throw new Error("useSSE must be used within SSEProvider")
  return ctx
}

export function useSSEEvent(eventType: string, handler: (data: any) => void) {
  const { subscribe } = useSSE()
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  React.useEffect(() => {
    return subscribe(eventType, (data) => handlerRef.current(data))
  }, [eventType, subscribe])
}
