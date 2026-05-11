"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import {
  Target,
  Brain,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Zap,
  Loader2,
  AlertCircle,
} from "lucide-react"
import {
  apiClient,
  type AnalyticsResponse,
  type Workspace,
  type MasteryLevel,
} from "@/lib/apiClient"
import { toast } from "@/hooks/use-toast"
import { getErrorMessage, isUnauthorizedError } from "@/lib/errorMessages"
import { LoadingState } from "@/components/ui/loading-state"

// ─── helpers ────────────────────────────────────────────────────────────────

const MASTERY_COLOR: Record<MasteryLevel, string> = {
  not_started: "#6b7280",
  developing: "#ef4444",
  proficient: "#f59e0b",
  strong: "#22c55e",
}

const MASTERY_LABEL: Record<MasteryLevel, string> = {
  not_started: "Not started",
  developing: "Developing",
  proficient: "Proficient",
  strong: "Strong",
}

// Vivid colors chosen to read well on both dark and light backgrounds
const ERROR_COLORS_DARK = ["#f87171", "#fbbf24", "#60a5fa", "#c084fc", "#f472b6"]
const ERROR_COLORS_LIGHT = ["#dc2626", "#d97706", "#2563eb", "#9333ea", "#db2777"]

function useChartTokens(resolvedTheme: string | undefined) {
  const isDark = resolvedTheme !== "light"
  return {
    isDark,
    textColor: isDark ? "#cbd5e1" : "#334155",
    gridColor: isDark ? "#1e293b" : "#e2e8f0",
    tooltipBg: isDark ? "#1e293b" : "#ffffff",
    tooltipBorder: isDark ? "#334155" : "#e2e8f0",
    tooltipText: isDark ? "#f1f5f9" : "#0f172a",
    errorColors: isDark ? ERROR_COLORS_DARK : ERROR_COLORS_LIGHT,
  }
}

function formatConceptLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <Brain className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-lg font-semibold">No analytics yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Submit answers on a generated exam to start tracking your progress.
        </p>
      </div>
    </div>
  )
}

function ConceptMasteryChart({
  data,
  tokens,
}: {
  data: AnalyticsResponse["concept_mastery"]
  tokens: ReturnType<typeof useChartTokens>
}) {
  const chartData = Object.entries(data).map(([key, val]) => ({
    concept: formatConceptLabel(key),
    score: Math.round(val.score * 100),
    level: val.level,
  }))

  if (chartData.length === 0) return <EmptyState />

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 48)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12, fill: tokens.textColor }}
        />
        <YAxis
          type="category"
          dataKey="concept"
          width={160}
          tick={{ fontSize: 12, fill: tokens.textColor }}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, "Score"]}
          contentStyle={{
            backgroundColor: tokens.tooltipBg,
            borderColor: tokens.tooltipBorder,
            color: tokens.tooltipText,
            borderRadius: "8px",
          }}
          labelStyle={{ color: tokens.tooltipText }}
        />
        <Bar dataKey="score" radius={4}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={MASTERY_COLOR[entry.level]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ErrorDistributionChart({
  data,
  tokens,
}: {
  data: AnalyticsResponse["error_distribution"]
  tokens: ReturnType<typeof useChartTokens>
}) {
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([key, value]) => ({ name: formatConceptLabel(key), value }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No errors recorded yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
          labelLine={{ stroke: tokens.textColor }}
          labelStyle={{ fill: tokens.textColor, fontSize: 12 }}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={tokens.errorColors[i % tokens.errorColors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [value, "Occurrences"]}
          contentStyle={{
            backgroundColor: tokens.tooltipBg,
            borderColor: tokens.tooltipBorder,
            color: tokens.tooltipText,
            borderRadius: "8px",
          }}
          labelStyle={{ color: tokens.tooltipText }}
        />
        <Legend
          wrapperStyle={{ color: tokens.textColor, fontSize: 13 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function PerformanceTrendChart({
  data,
  tokens,
}: {
  data: AnalyticsResponse["performance_trend"]
  tokens: ReturnType<typeof useChartTokens>
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Complete more submissions to see your trend
      </div>
    )
  }

  const chartData = data.map((entry) => ({
    session: `#${entry.session}`,
    score: Math.round(entry.score * 100),
  }))

  // Primary color: vivid blue-indigo
  const primaryStroke = tokens.isDark ? "#818cf8" : "#4f46e5"

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.gridColor} />
        <XAxis dataKey="session" tick={{ fontSize: 12, fill: tokens.textColor }} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 12, fill: tokens.textColor }}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, "Score"]}
          contentStyle={{
            backgroundColor: tokens.tooltipBg,
            borderColor: tokens.tooltipBorder,
            color: tokens.tooltipText,
            borderRadius: "8px",
          }}
          labelStyle={{ color: tokens.tooltipText }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={primaryStroke}
          strokeWidth={2}
          dot={{ r: 4, fill: primaryStroke, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: primaryStroke }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── recommendation card ────────────────────────────────────────────────────

type PracticeState = { status: "idle" | "polling" | "failed" }

function RecommendationCard({
  concept,
  reason,
  workspaceId,
  onStartPractice,
  practiceState,
}: {
  concept: string
  reason: string
  workspaceId: string
  onStartPractice: (concept: string) => void
  practiceState: PracticeState
}) {
  return (
    <div className="p-5 rounded-lg border bg-secondary/30 border-border/50">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <h4 className="font-semibold">{formatConceptLabel(concept)}</h4>
          <p className="text-sm text-muted-foreground">{reason}</p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          disabled={practiceState.status === "polling"}
          onClick={() => onStartPractice(concept)}
        >
          {practiceState.status === "polling" ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Generating…
            </>
          ) : practiceState.status === "failed" ? (
            "Retry"
          ) : (
            "Start Targeted Practice"
          )}
        </Button>
      </div>
      {practiceState.status === "failed" && (
        <p className="mt-2 text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Generation failed. Try again.
        </p>
      )}
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const tokens = useChartTokens(resolvedTheme)

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string>("")
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [practiceStates, setPracticeStates] = useState<Record<string, PracticeState>>({})

  const pollIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // fetch workspaces on mount
  useEffect(() => {
    setWorkspaceLoading(true)
    apiClient
      .listWorkspaces()
      .then((ws) => {
        setWorkspaces(ws)
        if (ws.length > 0) setWorkspaceId(ws[0].id)
      })
      .catch((err) => {
        const message = getErrorMessage(err)
        setError(message)
        toast({
          variant: "destructive",
          title: "Unable to load workspaces",
          description: message,
        })
        if (isUnauthorizedError(err)) {
          router.replace("/login")
        }
      })
      .finally(() => {
        setWorkspaceLoading(false)
      })
  }, [router])

  // fetch analytics when workspace changes
  useEffect(() => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    setAnalytics(null)
    setPracticeStates({})
    apiClient
      .getAnalytics(workspaceId)
      .then((data) => {
        setAnalytics(data)
      })
      .catch((err) => {
        const message = getErrorMessage(err)
        setError(message)
        toast({
          variant: "destructive",
          title: "Unable to load analytics",
          description: message,
        })
        if (isUnauthorizedError(err)) {
          router.replace("/login")
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [workspaceId, router])

  // cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollIntervalsRef.current).forEach(clearInterval)
    }
  }, [])

  const handleStartPractice = useCallback(
    async (concept: string) => {
      if (!workspaceId) return

      setPracticeStates((prev) => ({ ...prev, [concept]: { status: "polling" } }))

      let requestId: string
      try {
        const resp = await apiClient.postRegenerationRequest(workspaceId, {
          target_concepts: [concept],
          question_count: 5,
          format_type: "mixed",
        })
        requestId = resp.id
      } catch (err) {
        setPracticeStates((prev) => ({ ...prev, [concept]: { status: "failed" } }))
        toast({
          variant: "destructive",
          title: "Unable to start targeted practice",
          description: getErrorMessage(err),
        })
        if (isUnauthorizedError(err)) {
          router.replace("/login")
        }
        return
      }

      const intervalId = setInterval(async () => {
        try {
          const resp = await apiClient.getRegenerationRequest(workspaceId, requestId)
          if (resp.status === "completed" && resp.generated_exam_id) {
            clearInterval(intervalId)
            delete pollIntervalsRef.current[concept]
            router.push(`/dashboard/workspaces/${workspaceId}/exams/${resp.generated_exam_id}`)
          } else if (resp.status === "failed") {
            clearInterval(intervalId)
            delete pollIntervalsRef.current[concept]
            setPracticeStates((prev) => ({ ...prev, [concept]: { status: "failed" } }))
          }
        } catch (err) {
          clearInterval(intervalId)
          delete pollIntervalsRef.current[concept]
          setPracticeStates((prev) => ({ ...prev, [concept]: { status: "failed" } }))
          toast({
            variant: "destructive",
            title: "Unable to refresh targeted practice status",
            description: getErrorMessage(err),
          })
          if (isUnauthorizedError(err)) {
            router.replace("/login")
          }
        }
      }, 3000)

      pollIntervalsRef.current[concept] = intervalId
    },
    [workspaceId, router],
  )

  const isEmpty =
    analytics &&
    Object.keys(analytics.concept_mastery).length === 0 &&
    analytics.performance_trend.length === 0 &&
    analytics.recommendations.length === 0

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your progress and identify areas for improvement
          </p>
        </div>
        <Select value={workspaceId} onValueChange={setWorkspaceId}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Select workspace…" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {workspaceLoading && !workspaceId && (
        <LoadingState
          title="Loading analytics workspaces..."
          description="Preparing your analytics dashboard."
        />
      )}

      {loading && !workspaceLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && !loading && !workspaceLoading && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col gap-4 px-6 py-8">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Unable to load analytics</span>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No workspace selected */}
      {!workspaceLoading && !workspaceId && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <Brain className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Select a workspace above to view analytics.</p>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !loading && !error && <EmptyState />}

      {/* Main content */}
      {analytics && !isEmpty && !loading && !error && (
        <Tabs defaultValue="progress" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="progress" className="gap-2">
              <LineChartIcon className="h-4 w-4" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="concepts" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Concepts
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2">
              <Zap className="h-4 w-4" />
              Recommendations
              {analytics.recommendations.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {analytics.recommendations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Progress tab */}
          <TabsContent value="progress" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5 text-primary" />
                    Score Over Time
                  </CardTitle>
                  <CardDescription>Your exam score by submission session</CardDescription>
                </CardHeader>
                <CardContent>
                  <PerformanceTrendChart data={analytics.performance_trend} tokens={tokens} />
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-accent" />
                    Error Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of error types across all submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ErrorDistributionChart data={analytics.error_distribution} tokens={tokens} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Concepts tab */}
          <TabsContent value="concepts" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Concept Mastery</CardTitle>
                <CardDescription>
                  Score per concept across all graded submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex flex-wrap gap-3 mb-4">
                  {(["strong", "proficient", "developing", "not_started"] as MasteryLevel[]).map((level) => (
                    <div key={level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: MASTERY_COLOR[level] }}
                      />
                      {MASTERY_LABEL[level]}
                    </div>
                  ))}
                </div>
                <ConceptMasteryChart data={analytics.concept_mastery} tokens={tokens} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommendations tab */}
          <TabsContent value="recommendations" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Targeted Practice Recommendations
                </CardTitle>
                <CardDescription>
                  Concepts to focus on, ranked by urgency. Click to generate a targeted practice set.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.recommendations.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center gap-3">
                    <Target className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No recommendations yet — keep practicing!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analytics.recommendations.map((rec) => (
                      <RecommendationCard
                        key={rec.concept}
                        concept={rec.concept}
                        reason={rec.reason}
                        workspaceId={workspaceId}
                        onStartPractice={handleStartPractice}
                        practiceState={practiceStates[rec.concept] ?? { status: "idle" }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
