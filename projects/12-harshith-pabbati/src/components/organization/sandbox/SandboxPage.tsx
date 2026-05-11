'use client';

import { useState } from 'react';
import { Link } from 'next-view-transitions';
import { ArrowLeftIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SandboxSection {
  content: string;
  similarity: number;
  datasourceUrl?: string;
}

interface SandboxResult {
  html: string;
  confidence: number;
  vectorConfidence: number;
  modelConfidence: number;
  partial: boolean;
  citations: string[];
  sections: SandboxSection[];
}

function ConfidenceBar({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description?: string;
}) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 65 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-foreground">
          {label}
        </span>
        <span
          className={cn(
            'border px-2 py-0.5 font-mono text-xs font-bold tabular-nums',
            pct >= 65
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : pct >= 40
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden bg-muted">
        <div
          className={cn('h-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {description && (
        <p className="font-mono text-[10px] text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

export function SandboxPage({ orgId, slug }: { orgId: string; slug: string }) {
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    setExpandedSections(new Set());
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, question, subject }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('Failed to generate preview', {
          description: data.error ?? 'Unknown error',
        });
      } else {
        setResult(data);
      }
    } catch {
      toast.error('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (i: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-[#FF4500]/20 px-6 py-6 md:px-10 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#FF4500 1px, transparent 1px), linear-gradient(90deg, #FF4500 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="mb-3">
          <Link
            href={`/org/${slug}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-[#FF4500]"
          >
            <ArrowLeftIcon className="size-3" />
            Back to dashboard
          </Link>
        </div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// TEST SANDBOX'}
        </p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground">
          AI Preview
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          Preview how the AI would reply to a sample customer question using
          your knowledge base and tone settings.
        </p>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Input form */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4500]">
                  {'// Subject (optional)'}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. How do I reset my password?"
                  className="w-full border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-[#FF4500]/50 focus:outline-none focus:ring-2 focus:ring-[#FF4500]"
                />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#FF4500]">
                  {'// Customer question '}
                  <span className="text-[#FF4500]">*</span>
                </label>
                <textarea
                  rows={7}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Paste or type a sample customer email body here…"
                  className="w-full resize-y border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-[#FF4500]/50 focus:outline-none focus:ring-2 focus:ring-[#FF4500]"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || !question.trim()}
                className="w-full"
              >
                {loading ? 'Generating preview…' : 'Generate Preview Reply'}
              </Button>
            </div>

            {/* Confidence panel */}
            {result && (
              <div className="space-y-4 border border-[#FF4500]/20 bg-card p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
                  {'// Confidence Breakdown'}
                </p>
                <ConfidenceBar
                  label="Final (Blended)"
                  value={result.confidence}
                  description="Weighted average of vector and model confidence scores."
                />
                <ConfidenceBar
                  label="Vector Confidence"
                  value={result.vectorConfidence}
                  description="How well the knowledge base matched the question."
                />
                <ConfidenceBar
                  label="Model Confidence"
                  value={result.modelConfidence}
                  description="How confident the AI was in its answer."
                />
                {result.citations.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#FF4500]/10">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
                      {'// Sources Used'}
                    </p>
                    <ul className="space-y-1">
                      {result.citations.map((url) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 font-mono text-xs text-foreground underline-offset-2 transition-opacity hover:opacity-70"
                          >
                            <ExternalLinkIcon className="size-3 shrink-0 text-[#FF4500]" />
                            <span className="truncate">{url}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reply preview */}
          {result && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
                {'// AI Reply Preview'}
              </p>
              {result.partial && (
                <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-4">
                  <span className="mt-0.5 text-amber-500">⚠</span>
                  <div>
                    <p className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Partial Answer — Needs Review
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      The AI could only partially answer this question from the
                      knowledge base. This reply would be saved as a draft for a
                      support agent to review and complete before sending.
                    </p>
                  </div>
                </div>
              )}
              <div className="bg-background border-[#FF4500]/20 overflow-hidden break-words border p-4 text-sm text-foreground">
                <div
                  className="email-content"
                  dangerouslySetInnerHTML={{ __html: result.html }}
                />
              </div>
            </div>
          )}

          {/* Matched sections */}
          {result && result.sections.length > 0 && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
                {'// Matched Knowledge Base Sections'}
              </p>
              <div className="space-y-2">
                {Object.values(
                  result.sections
                    .filter((section) => section?.similarity > 0)
                    .reduce((acc: Record<string, SandboxSection>, section) => {
                      const key = section.datasourceUrl || section.content;
                      if (acc[key]) {
                        acc[key] = {
                          ...acc[key],
                          content: acc[key].content + '\n\n' + section.content,
                          similarity: Math.max(
                            acc[key].similarity,
                            section.similarity
                          ),
                        };
                      } else {
                        acc[key] = { ...section };
                      }
                      return acc;
                    }, {})
                ).map((section, i) => (
                  <div
                    key={i}
                    className="border border-[#FF4500]/15 bg-card transition-colors hover:border-[#FF4500]/40"
                  >
                    <button
                      onClick={() => toggleSection(i)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            'shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums',
                            section.similarity >= 0.65
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : section.similarity >= 0.4
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400'
                          )}
                        >
                          {Math.round(section.similarity * 100)}%
                        </span>
                        {section.datasourceUrl && (
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {section.datasourceUrl}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {expandedSections.has(i) ? '▲ hide' : '▼ show'}
                      </span>
                    </button>
                    {expandedSections.has(i) && (
                      <div className="border-t border-[#FF4500]/10 px-4 py-3">
                        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                          {section.content}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
