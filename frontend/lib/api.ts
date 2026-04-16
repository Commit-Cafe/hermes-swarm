"use client"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8001/api/v1'

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }
  const response = await fetch(url, config)
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`)
  }
  return await response.json()
}

export const api = {
  createTask: (data: { name: string; prompt: string; model?: string; provider?: string; skills?: string; timeout?: number }) =>
    apiCall<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listTasks: (params?: { status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.append('status', params.status)
    if (params?.limit) sp.append('limit', String(params.limit))
    if (params?.offset) sp.append('offset', String(params.offset))
    const qs = sp.toString()
    return apiCall<any>(`/tasks${qs ? '?' + qs : ''}`)
  },

  getTask: (taskId: string) => apiCall<any>(`/tasks/${taskId}`),

  cancelTask: (taskId: string) =>
    apiCall<any>(`/tasks/${taskId}/cancel`, { method: 'POST' }),

  getTaskLogs: (taskId: string, params?: { stream?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.stream) sp.append('stream', params.stream)
    if (params?.limit) sp.append('limit', String(params.limit))
    const qs = sp.toString()
    return apiCall<any>(`/tasks/${taskId}/logs${qs ? '?' + qs : ''}`)
  },

  getKPIs: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams()
    if (params?.startDate) sp.append('start_date', params.startDate)
    if (params?.endDate) sp.append('end_date', params.endDate)
    const qs = sp.toString()
    return apiCall<any>(`/dashboard/kpis${qs ? '?' + qs : ''}`)
  },

  getSeries: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams()
    if (params?.startDate) sp.append('start_date', params.startDate)
    if (params?.endDate) sp.append('end_date', params.endDate)
    const qs = sp.toString()
    return apiCall<any>(`/dashboard/series${qs ? '?' + qs : ''}`)
  },

  getAgentsStatus: () => apiCall<any>('/agents/status'),

  getEventStreamUrl: () => `${API_BASE_URL}/tasks/stream`,
}
