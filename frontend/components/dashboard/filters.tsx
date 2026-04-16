"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { IconCalendar, IconFilter, IconSearch, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { type Filters, defaultFilters } from "@/lib/analytics"

const timeRangeOptions = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' }
]

const agentOptions = [
  'agent-1',
  'agent-2'
]

const defaultModelOptions = [
  'GPT-4o',
  'GPT-4.1',
  'o3',
  'o3-mini',
  'o4-mini'
]

const errorTypeOptions = [
  'Rate Limit',
  'Timeout',
  'Auth Error',
  'Server Error',
  'Validation Error'
]

const statusOptions = [
  'active',
  'completed',
  'error',
  'pending'
]

interface DashboardFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  availableModels?: string[]
}

export function DashboardFilters({ filters, onFiltersChange, availableModels }: DashboardFiltersProps) {
  console.log('Filters: Received availableModels:', availableModels)
  const modelOptions = availableModels || defaultModelOptions
  console.log('Filters: Using modelOptions:', modelOptions)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [traceIdInput, setTraceIdInput] = React.useState(filters.traceId || '')

  const updateFilters = (updates: Partial<Filters>) => {
    const newFilters = { ...filters, ...updates }
    onFiltersChange(newFilters)
    
    // Update URL params
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        params.set(key, Array.isArray(value) ? value.join(',') : String(value))
      } else {
        params.delete(key)
      }
    })
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const clearAllFilters = () => {
    setTraceIdInput('')
    onFiltersChange(defaultFilters)
    router.push(window.location.pathname, { scroll: false })
  }

  const handleTraceIdSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ traceId: traceIdInput || undefined })
  }

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (filters.agents.length > 0) count++
    if (filters.models.length > 0) count++
    if (filters.errorTypes.length > 0) count++
    if (filters.status && filters.status.length > 0) count++
    if (filters.traceId) count++
    return count
  }, [filters])

  return (
    <div className="space-y-4 border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex flex-wrap items-center gap-4">
        {/* Time Range */}
        <div className="flex items-center gap-2">
          <Label htmlFor="time-range" className="text-sm font-medium">
            Time Range
          </Label>
          <Select
            value={filters.timeRange}
            onValueChange={(value: Filters["timeRange"]) => updateFilters({ timeRange: value })}
          >
            <SelectTrigger className="w-40" id="time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {filters.timeRange === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => updateFilters({ startDate: e.target.value })}
              className="w-36"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => updateFilters({ endDate: e.target.value })}
              className="w-36"
            />
          </div>
        )}

        {/* Trace ID Search */}
        <form onSubmit={handleTraceIdSubmit} className="flex items-center gap-2">
          <Label htmlFor="trace-id" className="text-sm font-medium">
            Trace ID
          </Label>
          <div className="relative">
            <IconSearch className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="trace-id"
              placeholder="Search trace..."
              value={traceIdInput}
              onChange={(e) => setTraceIdInput(e.target.value)}
              className="w-48 pl-8"
            />
          </div>
          {filters.traceId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTraceIdInput('')
                updateFilters({ traceId: undefined })
              }}
            >
              <IconX className="size-4" />
            </Button>
          )}
        </form>

        <Separator orientation="vertical" className="h-6" />

        {/* Advanced Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <IconFilter className="size-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 size-5 p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              {/* Agents */}
              <div>
                <Label className="text-sm font-medium">Agents</Label>
                <div className="mt-2 space-y-2">
                  {agentOptions.map((agent) => (
                    <div key={agent} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent}`}
                        checked={filters.agents.includes(agent)}
                        onCheckedChange={(checked) => {
                          const newAgents = checked
                            ? [...filters.agents, agent]
                            : filters.agents.filter(a => a !== agent)
                          updateFilters({ agents: newAgents })
                        }}
                      />
                      <Label htmlFor={`agent-${agent}`} className="text-sm">
                        {agent}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Models */}
              <div>
                <Label className="text-sm font-medium">Models</Label>
                <div className="mt-2 space-y-2">
                  {modelOptions.map((model) => (
                    <div key={model} className="flex items-center space-x-2">
                      <Checkbox
                        id={`model-${model}`}
                        checked={filters.models.includes(model)}
                        onCheckedChange={(checked) => {
                          const newModels = checked
                            ? [...filters.models, model]
                            : filters.models.filter(m => m !== model)
                          updateFilters({ models: newModels })
                        }}
                      />
                      <Label htmlFor={`model-${model}`} className="text-sm">
                        {model}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Error Types */}
              <div>
                <Label className="text-sm font-medium">Error Types</Label>
                <div className="mt-2 space-y-2">
                  {errorTypeOptions.map((errorType) => (
                    <div key={errorType} className="flex items-center space-x-2">
                      <Checkbox
                        id={`error-${errorType}`}
                        checked={filters.errorTypes.includes(errorType)}
                        onCheckedChange={(checked) => {
                          const newErrorTypes = checked
                            ? [...filters.errorTypes, errorType]
                            : filters.errorTypes.filter(e => e !== errorType)
                          updateFilters({ errorTypes: newErrorTypes })
                        }}
                      />
                      <Label htmlFor={`error-${errorType}`} className="text-sm">
                        {errorType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Status */}
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="mt-2 space-y-2">
                  {statusOptions.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.status?.includes(status) || false}
                        onCheckedChange={(checked) => {
                          const currentStatus = filters.status || []
                          const newStatus = checked
                            ? [...currentStatus, status]
                            : currentStatus.filter(s => s !== status)
                          updateFilters({ status: newStatus })
                        }}
                      />
                      <Label htmlFor={`status-${status}`} className="text-sm capitalize">
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filter Tags */}
      {(filters.agents.length > 0 || filters.models.length > 0 || filters.errorTypes.length > 0 || filters.status?.length || filters.traceId) && (
        <div className="flex flex-wrap gap-2">
          {filters.agents.map((agent) => (
            <Badge key={agent} variant="secondary" className="gap-1">
              Agent: {agent}
              <IconX
                className="size-3 cursor-pointer"
                onClick={() => updateFilters({ agents: filters.agents.filter(a => a !== agent) })}
              />
            </Badge>
          ))}
          {filters.models.map((model) => (
            <Badge key={model} variant="secondary" className="gap-1">
              Model: {model}
              <IconX
                className="size-3 cursor-pointer"
                onClick={() => updateFilters({ models: filters.models.filter(m => m !== model) })}
              />
            </Badge>
          ))}
          {filters.errorTypes.map((errorType) => (
            <Badge key={errorType} variant="secondary" className="gap-1">
              Error: {errorType}
              <IconX
                className="size-3 cursor-pointer"
                onClick={() => updateFilters({ errorTypes: filters.errorTypes.filter(e => e !== errorType) })}
              />
            </Badge>
          ))}
          {filters.status?.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              Status: {status}
              <IconX
                className="size-3 cursor-pointer"
                onClick={() => updateFilters({ status: filters.status?.filter(s => s !== status) })}
              />
            </Badge>
          ))}
          {filters.traceId && (
            <Badge variant="secondary" className="gap-1">
              Trace: {filters.traceId.slice(0, 8)}...
              <IconX
                className="size-3 cursor-pointer"
                onClick={() => {
                  setTraceIdInput('')
                  updateFilters({ traceId: undefined })
                }}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}