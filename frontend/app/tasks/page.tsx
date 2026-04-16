"use client"

import * as React from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function TasksPage() {
  const [name, setName] = React.useState("")
  const [prompt, setPrompt] = React.useState("")
  const [model, setModel] = React.useState("")
  const [provider, setProvider] = React.useState("")
  const [skills, setSkills] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<{ id: string; status: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !prompt.trim()) return

    setSubmitting(true)
    try {
      const result = await api.createTask({
        name: name.trim(),
        prompt: prompt.trim(),
        model: model.trim() || undefined,
        provider: provider.trim() || undefined,
        skills: skills.trim() || undefined,
      })
      setLastResult({ id: result.id, status: result.status })
      setName("")
      setPrompt("")
    } catch (err) {
      console.error("Failed to create task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <h1 className="text-xl font-semibold">Create New Task</h1>

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
                <Label htmlFor="model">Model (optional)</Label>
                <Input
                  id="model"
                  placeholder="e.g. glm-5"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider (optional)</Label>
                <Input
                  id="provider"
                  placeholder="e.g. zai"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills">Skills (optional)</Label>
                <Input
                  id="skills"
                  placeholder="e.g. skill1,skill2"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting || !name.trim() || !prompt.trim()}>
              {submitting ? "Creating..." : "Create Task & Start"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Last Created Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{lastResult.id}</Badge>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">
                {lastResult.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
