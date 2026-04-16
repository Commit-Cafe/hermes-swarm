export interface TimeSeriesPoint {
  timestamp: string
  date: string
  value: number
  p50?: number
  p95?: number
  errors?: number
  total?: number
}

export interface KPIMetric {
  title: string
  value: string | number
  change: number
  changeType: 'increase' | 'decrease'
  icon: string
  description: string
}

export interface Agent {
  id: string
  name: string
  status: 'active' | 'inactive' | 'error'
  model: string
  lastActive: string
  callsToday: number
  errorRate: number
  avgLatency: number
}

export interface Conversation {
  id: string
  agentId: string
  agentName: string
  startedAt: string
  duration: number
  messageCount: number
  status: 'completed' | 'active' | 'error'
  traceId: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  traceId: string
  agentId?: string
  model?: string
  conversationId?: string
  duration?: number
  tokens?: number
  cost?: number
}

export interface BreakdownItem {
  name: string
  value: number
  percentage: number
  color: string
}

export interface Filters {
  timeRange: '1h' | '24h' | '7d' | '30d' | 'custom'
  startDate?: string
  endDate?: string
  agents: string[]
  models: string[]
  errorTypes: string[]
  traceId?: string
  status?: string[]
}

function generateTimeSeries(
  points: number,
  baseValue: number,
  variance: number,
  trend = 0
): TimeSeriesPoint[] {
  const now = new Date()
  const data: TimeSeriesPoint[] = []
  
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    const trendValue = baseValue + (trend * (points - i))
    const value = Math.max(0, trendValue + (Math.random() - 0.5) * variance)
    
    data.push({
      timestamp: timestamp.toISOString(),
      date: timestamp.toLocaleDateString(),
      value: Math.round(value),
      p50: Math.round(value * 0.8),
      p95: Math.round(value * 1.5),
      errors: Math.round(value * 0.02),
      total: Math.round(value * 1.1)
    })
  }
  
  return data
}

export function getKPIMetrics(filters: Filters): KPIMetric[] {
  return [
    {
      title: 'LLM Calls',
      value: '12.4K',
      change: 12.5,
      changeType: 'increase',
      icon: 'activity',
      description: 'Total API calls in period'
    },
    {
      title: 'Error Rate',
      value: '2.1%',
      change: -0.8,
      changeType: 'decrease',
      icon: 'alert-circle',
      description: 'Failed requests percentage'
    },
    {
      title: 'Avg Latency',
      value: '245ms',
      change: -15.2,
      changeType: 'decrease',
      icon: 'clock',
      description: 'Mean response time'
    },
    {
      title: 'Tokens Used',
      value: '2.8M',
      change: 18.3,
      changeType: 'increase',
      icon: 'hash',
      description: 'Total tokens processed'
    },
    {
      title: 'Cost',
      value: '$342.50',
      change: 8.7,
      changeType: 'increase',
      icon: 'dollar-sign',
      description: 'Total cost this period'
    },
    {
      title: 'Tool Calls',
      value: '1.2K',
      change: 22.1,
      changeType: 'increase',
      icon: 'tool',
      description: 'Function calls executed'
    },
    {
      title: 'Active Agents',
      value: '24',
      change: 3,
      changeType: 'increase',
      icon: 'users',
      description: 'Agents with recent activity'
    },
    {
      title: 'Traffic Volume',
      value: '45.2K',
      change: 15.8,
      changeType: 'increase',
      icon: 'trending-up',
      description: 'Total requests processed'
    }
  ]
}

export function getTimeSeriesData(metric: string, filters: Filters): TimeSeriesPoint[] {
  const pointsMap = {
    '1h': 60,
    '24h': 24,
    '7d': 168,
    '30d': 720
  }
  
  const points = pointsMap[filters.timeRange as keyof typeof pointsMap] || 24
  
  switch (metric) {
    case 'calls':
      return generateTimeSeries(points, 500, 200, 5)
    case 'latency':
      return generateTimeSeries(points, 250, 100, -2)
    case 'errors':
      return generateTimeSeries(points, 10, 8, -0.5)
    case 'tokens':
      return generateTimeSeries(points, 12000, 3000, 100)
    case 'cost':
      return generateTimeSeries(points, 15, 8, 0.5)
    case 'tools':
      return generateTimeSeries(points, 50, 25, 2)
    case 'traffic':
      return generateTimeSeries(points, 1800, 600, 20)
    default:
      return generateTimeSeries(points, 100, 50, 1)
  }
}

export function getAgentBreakdown(filters: Filters): BreakdownItem[] {
  return [
    { name: 'ChatBot-Alpha', value: 4200, percentage: 35, color: 'hsl(var(--chart-1))' },
    { name: 'Assistant-Beta', value: 3100, percentage: 26, color: 'hsl(var(--chart-2))' },
    { name: 'Support-Gamma', value: 2400, percentage: 20, color: 'hsl(var(--chart-3))' },
    { name: 'Analytics-Delta', value: 1500, percentage: 12, color: 'hsl(var(--chart-4))' },
    { name: 'Other', value: 800, percentage: 7, color: 'hsl(var(--chart-5))' }
  ]
}

export function getModelBreakdown(filters: Filters): BreakdownItem[] {
  return [
    { name: 'GPT-4', value: 6500, percentage: 54, color: 'hsl(var(--chart-1))' },
    { name: 'GPT-3.5', value: 3200, percentage: 27, color: 'hsl(var(--chart-2))' },
    { name: 'Claude-3', value: 1800, percentage: 15, color: 'hsl(var(--chart-3))' },
    { name: 'Gemini', value: 500, percentage: 4, color: 'hsl(var(--chart-4))' }
  ]
}

export function getErrorBreakdown(filters: Filters): BreakdownItem[] {
  return [
    { name: 'Rate Limit', value: 120, percentage: 48, color: 'hsl(var(--chart-1))' },
    { name: 'Timeout', value: 80, percentage: 32, color: 'hsl(var(--chart-2))' },
    { name: 'Auth Error', value: 30, percentage: 12, color: 'hsl(var(--chart-3))' },
    { name: 'Server Error', value: 20, percentage: 8, color: 'hsl(var(--chart-4))' }
  ]
}

export function getToolBreakdown(filters: Filters): BreakdownItem[] {
  return [
    { name: 'Web Search', value: 450, percentage: 38, color: 'hsl(var(--chart-1))' },
    { name: 'Calculator', value: 320, percentage: 27, color: 'hsl(var(--chart-2))' },
    { name: 'Code Exec', value: 240, percentage: 20, color: 'hsl(var(--chart-3))' },
    { name: 'DB Query', value: 180, percentage: 15, color: 'hsl(var(--chart-4))' }
  ]
}

export function getAgents(filters: Filters): Agent[] {
  return [
    {
      id: 'agent-1',
      name: 'ChatBot-Alpha',
      status: 'active',
      model: 'GPT-4',
      lastActive: '2 minutes ago',
      callsToday: 1420,
      errorRate: 1.2,
      avgLatency: 234
    },
    {
      id: 'agent-2',
      name: 'Assistant-Beta',
      status: 'active',
      model: 'GPT-3.5',
      lastActive: '5 minutes ago',
      callsToday: 980,
      errorRate: 2.1,
      avgLatency: 189
    },
    {
      id: 'agent-3',
      name: 'Support-Gamma',
      status: 'error',
      model: 'Claude-3',
      lastActive: '1 hour ago',
      callsToday: 540,
      errorRate: 8.5,
      avgLatency: 456
    },
    {
      id: 'agent-4',
      name: 'Analytics-Delta',
      status: 'active',
      model: 'GPT-4',
      lastActive: '10 minutes ago',
      callsToday: 320,
      errorRate: 0.8,
      avgLatency: 312
    }
  ]
}

export function getConversations(filters: Filters): Conversation[] {
  return [
    {
      id: 'conv-1',
      agentId: 'agent-1',
      agentName: 'ChatBot-Alpha',
      startedAt: '2024-01-15T10:30:00Z',
      duration: 240,
      messageCount: 12,
      status: 'completed',
      traceId: 'trace-abc123'
    },
    {
      id: 'conv-2',
      agentId: 'agent-2',
      agentName: 'Assistant-Beta',
      startedAt: '2024-01-15T10:25:00Z',
      duration: 180,
      messageCount: 8,
      status: 'active',
      traceId: 'trace-def456'
    },
    {
      id: 'conv-3',
      agentId: 'agent-3',
      agentName: 'Support-Gamma',
      startedAt: '2024-01-15T10:20:00Z',
      duration: 0,
      messageCount: 3,
      status: 'error',
      traceId: 'trace-ghi789'
    }
  ]
}

export function getRecentLogs(filters: Filters): LogEntry[] {
  return [
    {
      id: 'log-1',
      timestamp: '2024-01-15T10:35:22Z',
      level: 'info',
      message: 'Request completed successfully',
      traceId: 'trace-abc123',
      agentId: 'agent-1',
      model: 'GPT-4',
      conversationId: 'conv-1',
      duration: 245,
      tokens: 450,
      cost: 0.012
    },
    {
      id: 'log-2',
      timestamp: '2024-01-15T10:35:18Z',
      level: 'warn',
      message: 'Rate limit approaching',
      traceId: 'trace-def456',
      agentId: 'agent-2',
      model: 'GPT-3.5'
    },
    {
      id: 'log-3',
      timestamp: '2024-01-15T10:35:15Z',
      level: 'error',
      message: 'Authentication failed',
      traceId: 'trace-ghi789',
      agentId: 'agent-3',
      model: 'Claude-3'
    },
    {
      id: 'log-4',
      timestamp: '2024-01-15T10:35:10Z',
      level: 'info',
      message: 'Tool call executed: web_search',
      traceId: 'trace-jkl012',
      agentId: 'agent-1',
      model: 'GPT-4',
      duration: 120
    },
    {
      id: 'log-5',
      timestamp: '2024-01-15T10:35:05Z',
      level: 'info',
      message: 'New conversation started',
      traceId: 'trace-mno345',
      agentId: 'agent-4',
      model: 'GPT-4'
    }
  ]
}

export const defaultFilters: Filters = {
  timeRange: '24h',
  agents: [],
  models: [],
  errorTypes: [],
  status: []
}