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

  return { tasks, loading, error, refetch: fetchTasks }
}

export function useAgentsStatus() {
  const [status, setStatus] = React.useState<{
    running: number
    max_concurrent: number
    active_processes: Record<string, { id: string; name: string; status: string; started_at: string | null }>
  } | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getAgentsStatus()
        setStatus(data)
      } catch {
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [])

  return { status, loading }
}

export function useSSE() {
  const [lastEvent, setLastEvent] = React.useState<any>(null)
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    const url = api.getEventStreamUrl()
    const es = new EventSource(url)

    es.onopen = () => setConnected(true)
    es.onmessage = (e) => {
      try {
        setLastEvent(JSON.parse(e.data))
      } catch {
      }
    }
    es.onerror = () => setConnected(false)

    return () => {
      es.close()
      setConnected(false)
    }
  }, [])

  return { lastEvent, connected }
}
