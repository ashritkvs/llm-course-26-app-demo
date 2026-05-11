'use client';

import { useState } from 'react';
import { Link } from 'next-view-transitions';
import { fetchMcpServers } from '@/actions/mcp-server';
import {
  updateAutopilotSettings,
  updateTonePolicy,
} from '@/actions/organization';
import { fetchSources } from '@/actions/source';
import { Tables } from '@/database.types';
import { useManageMcpServers } from '@/states/mcp-server';
import { useAddDataSource, useViewDataSource } from '@/states/data-source';
import {
  useInviteMembers,
  useUpdateOrganization,
} from '@/states/organization';
import {
  CheckIcon,
  ClipboardCopyIcon,
  ExternalLinkIcon,
  Link2Icon,
} from '@radix-ui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { AGENT_PRESETS, AgentPresetColor } from '@/lib/agent-presets';
import { mcpServersQueryKey, sourcesQueryKey } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmbeddingStatusBadge } from '@/components/ui/EmbeddingStatusBadge';

import { Slider } from '../ui/slider';

interface Props {
  orgId: string;
  orgName: string;
  slug: string;
  inboundEmail: string;
  supportEmail: string;
  sources: Tables<'datasource'>[];
  threadsCount: number;
  repliesCount: number;
  autopilotEnabled: boolean;
  autopilotThreshold: number;
  initialTonePolicy: string | null;
  initialMcpServers: Tables<'mcp_server'>[];
  workflowsCount: number;
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div className="group relative flex items-center gap-3 border border-[#FF4500]/20 bg-muted/50 px-4 py-3 transition-all duration-200 hover:border-[#FF4500]/60 hover:bg-[#FF4500]/5 overflow-hidden">
      {/* Animated left accent bar */}
      <span className="absolute left-0 top-0 h-full w-0.5 bg-[#FF4500] scale-y-0 origin-bottom transition-transform duration-200 group-hover:scale-y-100" />
      <span className="font-display text-2xl font-black tabular-nums text-foreground transition-colors group-hover:text-[#FF4500]">
        {value.toLocaleString()}
      </span>
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// ─── Step badge ───────────────────────────────────────────────────────────────

function StepBadge({ step, done }: { step: number; done: boolean }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center border-2 text-xs font-bold font-mono transition-all duration-200',
        done
          ? 'border-[#FF4500] bg-[#FF4500] text-white shadow-[0_0_8px_rgba(255,69,0,0.4)]'
          : 'border-[#FF4500]/40 bg-background text-muted-foreground'
      )}
    >
      {done ? '✓' : step}
    </span>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────

function ToolCard({
  icon,
  title,
  description,
  badge,
  accentColor = '#FF4500',
  children,
}: {
  icon: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col border border-[#FF4500]/15 bg-card transition-all duration-300 hover:border-[#FF4500]/50 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(255,69,0,0.12)]">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF4500]/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Corner decoration */}
      <div className="absolute top-0 right-0 size-0 border-l-[20px] border-b-[20px] border-l-transparent border-b-[#FF4500]/10 transition-all duration-300 group-hover:border-b-[#FF4500]/30" />

      <div className="flex items-start justify-between gap-2 p-5 pb-2">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center border border-[#FF4500]/20 bg-[#FF4500]/5 text-lg transition-all duration-200 group-hover:border-[#FF4500]/40 group-hover:bg-[#FF4500]/10">
            {icon}
          </span>
          <div>
            <p className="font-display text-sm font-black uppercase tracking-wide text-foreground">
              {title}
            </p>
          </div>
        </div>
        {badge}
      </div>

      <p className="px-5 pb-4 font-mono text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="mt-auto px-5 pb-5">{children}</div>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="border border-[#FF4500] bg-[#FF4500]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#FF4500] shadow-[0_0_6px_rgba(255,69,0,0.2)]">
      {count}
    </span>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
        {children}
      </p>
      <div className="h-px flex-1 bg-gradient-to-r from-[#FF4500]/30 to-transparent" />
    </div>
  );
}

// ─── Agent preset color classes ───────────────────────────────────────────────

const PRESET_COLOR_CLASSES: Record<
  AgentPresetColor,
  { border: string; bg: string; text: string; hoverBorder: string; hoverBg: string }
> = {
  blue: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    hoverBorder: 'hover:border-blue-500/60',
    hoverBg: 'hover:bg-blue-500/20',
  },
  green: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    hoverBorder: 'hover:border-green-500/60',
    hoverBg: 'hover:bg-green-500/20',
  },
  purple: {
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    hoverBorder: 'hover:border-purple-500/60',
    hoverBg: 'hover:bg-purple-500/20',
  },
  orange: {
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    hoverBorder: 'hover:border-orange-500/60',
    hoverBg: 'hover:bg-orange-500/20',
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

export function WelcomeDashboard({
  orgId,
  orgName,
  slug,
  inboundEmail,
  supportEmail,
  sources: initialSources,
  threadsCount,
  repliesCount,
  autopilotEnabled,
  autopilotThreshold,
  initialTonePolicy,
  initialMcpServers,
  workflowsCount,
}: Props) {
  const { copied, copyToClipboard } = useCopyToClipboard();
  const [, setAddDataSource] = useAddDataSource();
  const [, setViewDataSource] = useViewDataSource();
  const [, setInviteMembers] = useInviteMembers();
  const [, setUpdateOrganization] = useUpdateOrganization();
  const [, setManageMcpServers] = useManageMcpServers();

  const [enabled, setEnabled] = useState(autopilotEnabled);
  const [threshold, setThreshold] = useState(autopilotThreshold);
  const [saving, setSaving] = useState(false);

  const [tonePolicy, setTonePolicy] = useState(initialTonePolicy ?? '');
  const [savingTone, setSavingTone] = useState(false);

  const { data: sources = initialSources } = useQuery<Tables<'datasource'>[]>({
    queryKey: sourcesQueryKey(orgId),
    queryFn: () => fetchSources(orgId),
    initialData: initialSources,
    refetchInterval: (query) => {
      const list = (query.state.data ?? []) as Tables<'datasource'>[];
      const hasProcessing = list.some(
        (s) => s.status === 'pending' || s.status === 'processing'
      );
      return hasProcessing ? 4_000 : false;
    },
  });

  const { data: mcpServers = initialMcpServers } = useQuery<
    Tables<'mcp_server'>[]
  >({
    queryKey: mcpServersQueryKey(orgId),
    queryFn: () => fetchMcpServers(orgId),
    initialData: initialMcpServers,
  });

  const saveAutopilot = async (nextEnabled: boolean, nextThreshold: number) => {
    setSaving(true);
    const { error } = await updateAutopilotSettings(orgId, {
      autopilot_enabled: nextEnabled,
      autopilot_threshold: nextThreshold,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to save settings', { description: error.message });
      return false;
    }
    toast.success('Auto-reply settings saved');
    return true;
  };

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    const ok = await saveAutopilot(next, threshold);
    if (!ok) setEnabled(!next);
  };

  const handleThresholdCommit = async () => {
    if (saving) return;
    await saveAutopilot(enabled, threshold);
  };

  const handleSaveTonePolicy = async () => {
    setSavingTone(true);
    const { error } = await updateTonePolicy(orgId, tonePolicy);
    setSavingTone(false);
    if (error) {
      toast.error('Failed to save tone & policy', {
        description: error.message,
      });
    } else {
      toast.success('Tone & policy saved');
    }
  };

  const SOURCE_DISPLAY_LIMIT = 9;
  const visibleSources = sources.slice(0, SOURCE_DISPLAY_LIMIT);
  const hiddenCount = sources.length - SOURCE_DISPLAY_LIMIT;

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-[#FF4500]/20 px-6 py-6 md:px-10 overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#FF4500 1px, transparent 1px), linear-gradient(90deg, #FF4500 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// WORKSPACE'}
        </p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground">
          {orgName}
        </h1>

        {/* Stats row */}
        <div className="mt-5 flex flex-wrap gap-3">
          <StatChip value={threadsCount} label="Threads" />
          <StatChip value={repliesCount} label="Replies sent" />
          <StatChip value={sources.length} label="Data sources" />
          <StatChip value={mcpServers.length} label="MCP servers" />
          <StatChip value={workflowsCount} label="Workflows" />
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="space-y-8">
          {/* ── Row 1: Setup ─────────────────────────────────────────────── */}
          <div>
            <SectionLabel>{`// Setup`}</SectionLabel>
            <div className="grid gap-5 md:grid-cols-2">
              {/* Inbound Email */}
              <Card className="border-[#FF4500]/15 transition-all duration-300 hover:border-[#FF4500]/40 hover:shadow-[0_4px_24px_rgba(255,69,0,0.08)]">
                <CardHeader>
                  <CardTitle>📬 Inbound Email</CardTitle>
                  <CardDescription>
                    Forward your support emails here and Answerify handles the
                    rest automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="group/copy flex items-center justify-between gap-3 border border-[#FF4500]/30 bg-muted px-4 py-3 transition-colors hover:border-[#FF4500]/60 hover:bg-[#FF4500]/5">
                    <span className="truncate font-mono text-sm font-medium text-foreground">
                      {inboundEmail || 'Not configured yet'}
                    </span>
                    {inboundEmail && (
                      <button
                        onClick={() => copyToClipboard(inboundEmail)}
                        className="shrink-0 p-1 transition-opacity hover:opacity-70"
                        aria-label="Copy inbound email"
                      >
                        {copied ? (
                          <CheckIcon className="size-5 text-[#FF4500]" />
                        ) : (
                          <ClipboardCopyIcon className="size-5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Forwarding guides:{' '}
                    <a
                      href="https://support.google.com/mail/answer/10957"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF4500] underline underline-offset-2 transition-opacity hover:opacity-70"
                    >
                      Gmail
                    </a>
                    {' · '}
                    <a
                      href="https://support.google.com/a/answer/10486484"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF4500] underline underline-offset-2 transition-opacity hover:opacity-70"
                    >
                      Google Workspace
                    </a>
                    {' · '}
                    <a
                      href="https://docs.microsoft.com/en-us/microsoft-365/admin/email/configure-email-forwarding"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF4500] underline underline-offset-2 transition-opacity hover:opacity-70"
                    >
                      Microsoft 365
                    </a>
                  </p>
                </CardContent>
              </Card>

              {/* Quick Start */}
              <Card className="border-[#FF4500]/15 transition-all duration-300 hover:border-[#FF4500]/40 hover:shadow-[0_4px_24px_rgba(255,69,0,0.08)]">
                <CardHeader>
                  <CardTitle>🚀 Quick Start</CardTitle>
                  <CardDescription>
                    Follow these steps to get Answerify working for your team.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-4">
                    {[
                      {
                        label: 'Copy your inbound email address',
                        done: !!inboundEmail,
                      },
                      {
                        label:
                          'Set up email forwarding from your support account',
                        done: threadsCount > 0,
                      },
                      {
                        label: 'Add data sources to power AI replies',
                        done: sources.length > 0,
                      },
                      {
                        label: 'Send a test email and watch Answerify reply!',
                        done: repliesCount > 0,
                      },
                    ].map(({ label, done }, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <StepBadge step={i + 1} done={done} />
                        <span
                          className={cn(
                            'font-mono text-sm leading-snug transition-colors',
                            done
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          )}
                        >
                          {label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Row 2: Data Sources + AI config ─────────────────────────── */}
          <div>
            <SectionLabel>{`// Configuration`}</SectionLabel>
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Data Sources */}
              <Card className="border-[#FF4500]/15 transition-all duration-300 hover:border-[#FF4500]/40 hover:shadow-[0_4px_24px_rgba(255,69,0,0.08)]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>📚 Data Sources</CardTitle>
                      <CardDescription>
                        Knowledge base articles and docs that power AI replies.
                      </CardDescription>
                    </div>
                    <CountBadge count={sources.length} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sources.length === 0 ? (
                    <p className="font-mono text-sm text-muted-foreground">
                      No data sources yet. Add links to your docs, help center,
                      or blog to improve AI-generated replies.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {visibleSources.map((source) => (
                        <li key={source.id}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open data source: ${source.url}`}
                            className={cn(
                              'flex items-center gap-2 border bg-muted px-3 py-2 text-sm font-mono font-medium text-foreground transition-all',
                              source.status === 'ready'
                                ? 'border-[#FF4500]/20 hover:border-[#FF4500]/60 hover:bg-[#FF4500]/5'
                                : source.status === 'error'
                                  ? 'border-red-500/30 hover:border-red-500/60'
                                  : 'border-amber-500/30 hover:border-amber-500/60'
                            )}
                          >
                            <Link2Icon className="size-3.5 shrink-0" />
                            <span className="truncate">{source.url}</span>
                            <EmbeddingStatusBadge status={source.status} />
                            <ExternalLinkIcon className="size-3.5 shrink-0 opacity-50" />
                          </a>
                        </li>
                      ))}
                      {hiddenCount > 0 && (
                        <li>
                          <button
                            onClick={() => setViewDataSource(orgId)}
                            className="w-full border border-dashed border-[#FF4500]/30 py-2 text-center text-xs font-mono font-semibold text-muted-foreground transition-all hover:border-[#FF4500] hover:bg-[#FF4500]/5 hover:text-[#FF4500]"
                          >
                            +{hiddenCount} more source
                            {hiddenCount !== 1 ? 's' : ''}
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    {sources.length > 0 && (
                      <Button
                        variant="neutral"
                        className="flex-1"
                        onClick={() => setViewDataSource(orgId)}
                      >
                        View All
                      </Button>
                    )}
                    <Button
                      variant="default"
                      className={sources.length > 0 ? 'flex-1' : 'w-full'}
                      onClick={() => setAddDataSource({ slug, orgId })}
                    >
                      + Add Source
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* AI Config column */}
              <div className="flex flex-col gap-5">
                {/* AI Auto-Reply */}
                <Card className="border-[#FF4500]/15 transition-all duration-300 hover:border-[#FF4500]/40 hover:shadow-[0_4px_24px_rgba(255,69,0,0.08)]">
                  <CardHeader>
                    <CardTitle>🤖 AI Auto-Reply</CardTitle>
                    <CardDescription>
                      Automatically send replies when the AI confidence meets
                      the threshold you set.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          Enable Auto-Reply
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {enabled
                            ? 'Replies sent automatically when confidence is high enough.'
                            : 'Replies require manual approval before sending.'}
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={enabled}
                        onClick={handleToggle}
                        disabled={saving}
                        className={cn(
                          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500] disabled:opacity-50',
                          enabled
                            ? 'border-[#FF4500] bg-[#FF4500] shadow-[0_0_10px_rgba(255,69,0,0.3)]'
                            : 'border-[#FF4500]/30 bg-background'
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block size-5 border-2 bg-white shadow-sm transition-transform',
                            enabled
                              ? 'translate-x-5 border-white'
                              : 'translate-x-0.5 border-[#FF4500]/40'
                          )}
                        />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm font-semibold text-foreground">
                          Confidence Threshold
                        </p>
                        <span className="border border-[#FF4500] bg-[#FF4500]/10 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-[#FF4500] shadow-[0_0_6px_rgba(255,69,0,0.2)]">
                          {Math.round(threshold * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[threshold]}
                        onValueChange={(v) => setThreshold(v[0])}
                        disabled={saving}
                        onMouseUp={handleThresholdCommit}
                        onTouchEnd={handleThresholdCommit}
                      />
                      <div className="flex justify-between font-mono text-xs text-muted-foreground">
                        <span>0% — Send everything</span>
                        <span>100% — Only perfect matches</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tone & Policy */}
                <Card className="border-[#FF4500]/15 transition-all duration-300 hover:border-[#FF4500]/40 hover:shadow-[0_4px_24px_rgba(255,69,0,0.08)]">
                  <CardHeader>
                    <CardTitle>🎨 Tone &amp; Policy</CardTitle>
                    <CardDescription>
                      Describe how the AI should sound and any rules it must
                      follow (e.g. &ldquo;Always respond formally&rdquo;). Or
                      pick a preset agent below to get started quickly.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Agent Presets */}
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Agent Presets
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {AGENT_PRESETS.map((preset) => {
                          const colors =
                            PRESET_COLOR_CLASSES[preset.color];
                          return (
                            <button
                              key={preset.name}
                              type="button"
                              title={preset.description}
                              onClick={() => {
                                if (
                                  tonePolicy.trim() &&
                                  !window.confirm(
                                    `Replace your current Tone & Policy with the "${preset.name}" preset?`
                                  )
                                ) {
                                  return;
                                }
                                setTonePolicy(preset.systemPrompt);
                              }}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors',
                                colors.border,
                                colors.bg,
                                colors.text,
                                colors.hoverBorder,
                                colors.hoverBg
                              )}
                            >
                              🤖 {preset.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea
                      rows={4}
                      value={tonePolicy}
                      onChange={(e) => setTonePolicy(e.target.value)}
                      placeholder="e.g. Always respond in a formal tone. Never mention pricing. Sign off with 'Warm regards, the Support Team'."
                      className="w-full resize-y border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF4500] focus:border-[#FF4500]/50"
                    />
                    <Button
                      onClick={handleSaveTonePolicy}
                      disabled={savingTone}
                      className="w-full"
                    >
                      {savingTone ? 'Saving…' : 'Save Tone & Policy'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* ── Row 3: Tools grid ─────────────────────────────────────────── */}
          <div>
            <SectionLabel>{`// Tools & Settings`}</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Team */}
              <ToolCard
                icon="👥"
                title="Team"
                description="Invite team members and manage workspace settings."
              >
                <div className="flex flex-col gap-2">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => setInviteMembers(orgId)}
                  >
                    Invite Members
                  </Button>
                  <Button
                    variant="neutral"
                    className="w-full"
                    onClick={() =>
                      setUpdateOrganization({
                        id: orgId,
                        name: orgName,
                        support_email: supportEmail,
                      })
                    }
                  >
                    Settings
                  </Button>
                </div>
              </ToolCard>

              {/* MCP Servers */}
              <ToolCard
                icon="🔌"
                title="MCP Servers"
                description="Connect MCP servers so the AI can call their tools to fetch live customer data."
                badge={<CountBadge count={mcpServers.length} />}
              >
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setManageMcpServers({ orgId, slug })}
                >
                  Manage MCP Servers
                </Button>
              </ToolCard>

              {/* Workflows */}
              <ToolCard
                icon="⚡"
                title="Workflows"
                description="Automate actions based on email conditions — tag threads, send replies, call webhooks and more."
                badge={<CountBadge count={workflowsCount} />}
              >
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/org/${slug}/workflows`}>Open Workflows</Link>
                </Button>
              </ToolCard>

              {/* Sandbox */}
              <ToolCard
                icon="🧪"
                title="Sandbox"
                description="Send a test email to preview how Answerify would respond."
              >
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/org/${slug}/sandbox`}>Open Sandbox</Link>
                </Button>
              </ToolCard>

              {/* Admin */}
              <ToolCard
                icon="🛡️"
                title="Admin"
                description="Monitor datasource health, reindex stuck sources, and review AI reply logs."
              >
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/org/${slug}/admin`}>Open Admin</Link>
                </Button>
              </ToolCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
