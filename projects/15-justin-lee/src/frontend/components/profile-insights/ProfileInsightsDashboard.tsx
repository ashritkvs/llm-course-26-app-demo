"use client";

import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BookOpenText,
  BrainCircuit,
  Clock3,
  FileSearch,
  Files,
  Layers3,
  ListChecks,
  Sigma,
  Target,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type {
  DifficultyAxisLevel,
  DifficultyProfile,
  DocumentSourceType,
  EvidenceStrength,
  ProfessorProfile,
  ProfileQuestionType,
} from "@/lib/apiClient";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

type ProfileInsightsDashboardProps = {
  profile: ProfessorProfile;
  workspaceTitle: string;
  courseCode?: string | null;
};

type AxisDescriptor = {
  label: string;
  axis: DifficultyProfile["calculation_intensity"];
};

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPercent(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

function formatQuestionTypeLabel(questionType: ProfileQuestionType): string {
  switch (questionType) {
    case "mcq":
      return "Multiple choice";
    case "frq":
      return "Free response";
    case "calculation":
      return "Calculation";
    case "proof":
      return "Proof";
    case "mixed":
      return "Mixed";
    default:
      return questionType;
  }
}

function formatSourceTypeLabel(sourceType: DocumentSourceType): string {
  switch (sourceType) {
    case "prior_exam":
      return "Prior exams";
    case "practice_test":
      return "Practice tests";
    case "lecture_slides":
      return "Lecture slides";
    case "notes":
      return "Notes";
    case "homework":
      return "Homework";
    default:
      return sourceType;
  }
}

function formatDifficultyLabel(level: string): string {
  return toTitleCase(level);
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function levelToPercent(level: DifficultyAxisLevel): number {
  switch (level) {
    case "low":
      return 34;
    case "moderate":
      return 67;
    case "high":
      return 100;
    default:
      return 0;
  }
}

function strengthClasses(strength: EvidenceStrength): string {
  switch (strength) {
    case "high":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "low":
      return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    default:
      return "border-border bg-secondary text-secondary-foreground";
  }
}

function getTopTopic(profile: ProfessorProfile): string {
  const firstTopic = profile.topic_distribution.topics[0];
  const topTopic = profile.topic_distribution.topics.reduce((current, topic) =>
    topic.weight > current.weight ? topic : current,
  );
  return toTitleCase(topTopic?.topic_label ?? firstTopic.topic_label);
}

function getTopQuestionType(profile: ProfessorProfile): string {
  const firstType = profile.question_type_distribution.question_types[0];
  const topType = profile.question_type_distribution.question_types.reduce((current, type) =>
    type.weight > current.weight ? type : current,
  );
  return formatQuestionTypeLabel(topType?.question_type ?? firstType.question_type);
}

function buildAxisDescriptors(profile: ProfessorProfile): AxisDescriptor[] {
  return [
    { label: "Calculation intensity", axis: profile.difficulty_profile.calculation_intensity },
    { label: "Conceptual intensity", axis: profile.difficulty_profile.conceptual_intensity },
    { label: "Multi-step reasoning", axis: profile.difficulty_profile.multi_step_reasoning },
    { label: "Time pressure", axis: profile.difficulty_profile.time_pressure },
  ];
}

export function ProfileInsightsDashboard({
  profile,
  workspaceTitle,
  courseCode,
}: ProfileInsightsDashboardProps) {
  const topicChartData = profile.topic_distribution.topics.map((topic, index) => ({
    label: toTitleCase(topic.topic_label),
    value: Math.round(topic.weight * 100),
    rationale: topic.rationale,
    evidenceStrength: topic.evidence_strength,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const questionTypeData = profile.question_type_distribution.question_types.map((entry, index) => ({
    label: formatQuestionTypeLabel(entry.question_type),
    value: Math.round(entry.weight * 100),
    rationale: entry.rationale,
    evidenceStrength: entry.evidence_strength,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const sourceEvidenceData = profile.evidence_summary.source_counts.map((entry, index) => ({
    label: formatSourceTypeLabel(entry.source_type),
    documents: entry.document_count,
    chunks: entry.chunk_count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const axisDescriptors = buildAxisDescriptors(profile);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
          <CardContent className="px-6 py-6">
            <Badge variant="outline" className="bg-background/70">
              Upcoming exam outlook
            </Badge>
            <div className="mt-4 space-y-3">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                  Insights for {workspaceTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {courseCode ? `${courseCode} · ` : ""}
                  Profile v{profile.version} updated {formatTimestamp(profile.updated_at)}
                </p>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-foreground/90">
                {profile.exam_structure_profile.summary}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Most likely topic
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{getTopTopic(profile)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Dominant format
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {getTopQuestionType(profile)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Difficulty
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatDifficultyLabel(profile.difficulty_profile.estimated_level)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Typical length
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {profile.exam_structure_profile.typical_question_count} questions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">At a Glance</CardTitle>
            <CardDescription>Backend-generated signals grounded in retrieved evidence.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Files className="h-4 w-4" />
                Evidence base
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {profile.evidence_summary.total_documents}
              </p>
              <p className="text-sm text-muted-foreground">documents and {profile.evidence_summary.total_chunks} retrieved chunks</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Question mix
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {questionTypeData[0]?.value ?? 0}%
              </p>
              <p className="text-sm text-muted-foreground">
                {questionTypeData[0]?.label ?? "Question type"} is the strongest detected format
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sigma className="h-4 w-4" />
                Confidence
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatDifficultyLabel(profile.difficulty_profile.confidence)}
              </p>
              <p className="text-sm text-muted-foreground">
                Confidence in the current difficulty signal
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Question range
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {profile.exam_structure_profile.minimum_question_count} to {profile.exam_structure_profile.maximum_question_count}
              </p>
              <p className="text-sm text-muted-foreground">Likely question-count range for the upcoming exam</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Expected Question Mix
            </CardTitle>
            <CardDescription>{profile.question_type_distribution.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={questionTypeData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {questionTypeData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Share"]}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--background))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {questionTypeData.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{entry.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.rationale}</p>
                    </div>
                    <Badge className={strengthClasses(entry.evidenceStrength)} variant="outline">
                      {toTitleCase(entry.evidenceStrength)} evidence
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={entry.value} className="h-2.5 flex-1" />
                    <span className="min-w-12 text-right text-sm font-semibold text-foreground">
                      {entry.value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BrainCircuit className="h-5 w-5 text-primary" />
              Difficulty Signals
            </CardTitle>
            <CardDescription>{profile.difficulty_profile.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Estimated level</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {formatDifficultyLabel(profile.difficulty_profile.estimated_level)}
                  </p>
                </div>
                <Badge className={strengthClasses(profile.difficulty_profile.confidence)} variant="outline">
                  {toTitleCase(profile.difficulty_profile.confidence)} confidence
                </Badge>
              </div>
            </div>

            {axisDescriptors.map(({ label, axis }) => (
              <div key={label} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{label}</p>
                  <span className="text-sm text-muted-foreground">{formatDifficultyLabel(axis.level)}</span>
                </div>
                <Progress value={levelToPercent(axis.level)} className="mt-3 h-2.5" />
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{axis.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpenText className="h-5 w-5 text-primary" />
              Topics Most Likely to Appear
            </CardTitle>
            <CardDescription>{profile.topic_distribution.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicChartData} layout="vertical" margin={{ left: 16, right: 12 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" hide domain={[0, 100]} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={150}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Likelihood"]}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--background))",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {topicChartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {topicChartData.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{entry.label}</p>
                    <Badge className={strengthClasses(entry.evidenceStrength)} variant="outline">
                      {formatPercent(entry.value / 100)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.rationale}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers3 className="h-5 w-5 text-primary" />
              Expected Exam Structure
            </CardTitle>
            <CardDescription>What the current profile suggests about pacing and layout.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Minimum</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {profile.exam_structure_profile.minimum_question_count}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Typical</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {profile.exam_structure_profile.typical_question_count}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm text-muted-foreground">Maximum</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {profile.exam_structure_profile.maximum_question_count}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ListChecks className="h-4 w-4 text-primary" />
                Section patterns
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.exam_structure_profile.section_patterns.length > 0 ? (
                  profile.exam_structure_profile.section_patterns.map((pattern) => (
                    <Badge key={pattern} variant="secondary" className="rounded-full px-3 py-1">
                      {pattern}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No explicit section pattern detected.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Tendency notes
              </div>
              <ul className="mt-3 space-y-3">
                {profile.exam_structure_profile.tendency_notes.map((note) => (
                  <li key={note} className="text-sm leading-6 text-muted-foreground">
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sigma className="h-4 w-4 text-primary" />
                Answer expectations
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.exam_structure_profile.answer_format_expectations.map((expectation) => (
                  <Badge key={expectation} variant="outline" className="rounded-full px-3 py-1">
                    {expectation}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSearch className="h-5 w-5 text-primary" />
            Evidence Behind This Profile
          </CardTitle>
          <CardDescription>{profile.evidence_summary.evidence_characterization}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceEvidenceData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  angle={-10}
                  height={60}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                  }}
                />
                <Bar dataKey="documents" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="chunks" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Retrieval prompt</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {profile.evidence_summary.retrieval_query}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {profile.evidence_summary.source_counts.map((entry) => (
                <div key={entry.source_type} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="font-medium text-foreground">{formatSourceTypeLabel(entry.source_type)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.document_count} documents
                  </p>
                  <p className="text-sm text-muted-foreground">{entry.chunk_count} retrieved chunks</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
