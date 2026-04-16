"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const PROVIDERS = [
  { value: "", label: "Auto" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "openai-codex", label: "OpenAI Codex" },
  { value: "zai", label: "ZAI" },
  { value: "kimi-coding", label: "Kimi Coding" },
  { value: "minimax", label: "MiniMax" },
  { value: "huggingface", label: "HuggingFace" },
  { value: "copilot", label: "Copilot" },
  { value: "nous", label: "Nous" },
  { value: "xiaomi", label: "Xiaomi" },
  { value: "arcee", label: "Arcee" },
]

const POPULAR_MODELS = [
  { value: "", label: "Default" },
  { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "openai/gpt-4.1", label: "GPT-4.1" },
  { value: "openai/o3", label: "o3" },
  { value: "glm-5", label: "GLM-5" },
  { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
]

export default function TasksPage() {
  const [name, setName] = React.useState("")
  const [prompt, setPrompt] = React.useState("")
  const [model, setModel] = React.useState("")
  const [provider, setProvider] = React.useState("")
  const [skills, setSkills] = React.useState("")
  const [strategy, setStrategy] = React.useState("")
  const [strategyCount, setStrategyCount] = React.useState(3)
  const [submitting, setSubmitting] = React.useState(false)
  const [lastResults, setLastResults] = React.useState<{ id: string; status: string; name: string }[]>([])
  const [batchPrompts, setBatchPrompts] = React.useState("")
  const [batchNamePrefix, setBatchNamePrefix] = React.useState("batch")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return
    setSubmitting(true)
    try {
      const result = await api.createTask({
        name: name.trim(),
        prompt: prompt.trim(),
        model: model || undefined,
        provider: provider || undefined,
        skills: skills || undefined,
        strategy: strategy || undefined,
        strategy_count: strategy ? strategyCount : undefined,
      })
      setLastResults((prev) => [{ id: result.id, status: result.status, name: name.trim() }, ...prev])
      setName("")
      setPrompt("")
      setStrategy("")
    } catch (err) {
      console.error("Failed to create task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const lines = batchPrompts.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setSubmitting(true)
    const results: { id: string; status: string; name: string }[] = []
    for (let i = 0; i < lines.length; i++) {
      try {
        const result = await api.createTask({
          name: `${batchNamePrefix || "batch"}-${i + 1}`,
          prompt: lines[i],
          model: model || undefined,
          provider: provider || undefined,
          skills: skills || undefined,
        })
        results.push({ id: result.id, status: result.status, name: `${batchNamePrefix}-${i + 1}` })
      } catch (err) {
        console.error(`Failed to create batch task ${i + 1}:`, err)
      }
    }
    setLastResults((prev) => [...results.reverse(), ...prev])
    setBatchPrompts("")
    setSubmitting(false)
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Create Task</h1>
        <p className="text-[11px] text-muted-foreground">Dispatch prompts to your agent swarm</p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList>
          <TabsTrigger value="single">Single Task</TabsTrigger>
          <TabsTrigger value="batch">Batch Create</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Task Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Test Case 2 - API Integration"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <textarea
                    id="prompt"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Describe what Hermes should do..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <select
                      id="model"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {POPULAR_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <select
                      id="provider"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skills">Skills</Label>
                    <Input
                      id="skills"
                      placeholder="e.g. skill1,skill2"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="strategy">Strategy</Label>
                    <select
                      id="strategy"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                    >
                      <option value="">None (single run)</option>
                      <option value="best-of-n">Best-of-N (run N times, pick best)</option>
                      <option value="iterative">Iterative (refine N times)</option>
                    </select>
                  </div>
                  {strategy && (
                    <div className="space-y-2">
                      <Label htmlFor="strategyCount">Iterations (N)</Label>
                      <Input
                        id="strategyCount"
                        type="number"
                        min={2}
                        max={10}
                        value={strategyCount}
                        onChange={(e) => setStrategyCount(Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={submitting || !name.trim() || !prompt.trim()}>
                  {submitting ? "Creating..." : strategy === "best-of-n" ? `Create ${strategyCount} parallel tasks` : strategy === "iterative" ? "Create iterative task" : "Create Task & Start"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleBatchSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batchPrefix">Name Prefix</Label>
                  <Input
                    id="batchPrefix"
                    placeholder="e.g. batch"
                    value={batchNamePrefix}
                    onChange={(e) => setBatchNamePrefix(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchPrompts">Prompts (one per line)</Label>
                  <textarea
                    id="batchPrompts"
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={"Write a hello world in Python\nWrite a hello world in JavaScript\nWrite a hello world in Rust"}
                    value={batchPrompts}
                    onChange={(e) => setBatchPrompts(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {batchPrompts.split("\n").filter((l) => l.trim()).length} task(s) will be created
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {POPULAR_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    >
                      {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Skills</Label>
                    <Input
                      placeholder="e.g. skill1,skill2"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting || !batchPrompts.trim()}>
                  {submitting ? "Creating batch..." : `Create ${batchPrompts.split("\n").filter((l) => l.trim()).length} Tasks`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {lastResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Recently Created</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLastResults([])}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lastResults.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[9px] font-mono">{r.status}</Badge>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground text-xs">{r.id}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
