'use client';

import { useState } from 'react';
import {
  createWorkflow,
  deleteWorkflow,
  fetchWorkflows,
  toggleWorkflow,
  updateWorkflow,
} from '@/actions/workflow';
import { workflowsQueryKey } from '@/lib/query-keys';
import type {
  StepType,
  TriggerType,
  Workflow,
  WorkflowStep,
  WorkflowTrigger,
} from '@/lib/workflow-types';
import { ArrowLeftIcon, Pencil1Icon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ─── Metadata ────────────────────────────────────────────────────────────────

const TRIGGER_META: {
  value: TriggerType;
  label: string;
  hasValue: boolean;
  placeholder: string;
}[] = [
  {
    value: 'subject_contains',
    label: 'Subject contains keyword',
    hasValue: true,
    placeholder: 'billing, refund…',
  },
  {
    value: 'sender_domain',
    label: 'Sender from domain',
    hasValue: true,
    placeholder: 'example.com',
  },
  {
    value: 'has_tag',
    label: 'Has tag',
    hasValue: true,
    placeholder: 'billing, bug-report…',
  },
  {
    value: 'any_email',
    label: 'Any incoming email',
    hasValue: false,
    placeholder: '',
  },
];

const STEP_META: {
  value: StepType;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    value: 'add_tag',
    label: 'Add Tag',
    icon: '🏷️',
    color: 'border-violet-500/60',
  },
  {
    value: 'auto_reply',
    label: 'Auto Reply',
    icon: '💬',
    color: 'border-blue-500/60',
  },
  {
    value: 'escalate',
    label: 'Escalate',
    icon: '🚨',
    color: 'border-red-500/60',
  },
  {
    value: 'webhook',
    label: 'Call Webhook',
    icon: '🔗',
    color: 'border-green-500/60',
  },
];

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls =
  'w-full border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF4500]';
const selectCls =
  'w-full border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#FF4500] cursor-pointer';

// ─── Pipeline visual ──────────────────────────────────────────────────────────

function PipelineConnector() {
  return (
    <div className="flex flex-col items-center">
      <div className="h-5 w-px border-l-2 border-dashed border-[#FF4500]/40" />
      <span className="text-[8px] leading-none text-[#FF4500]/50">▼</span>
    </div>
  );
}

function TriggerNode({ trigger }: { trigger: WorkflowTrigger }) {
  const meta = TRIGGER_META.find((t) => t.value === trigger.type);
  return (
    <div className="w-full border-2 border-[#FF4500] bg-[#FF4500]/5 p-4 shadow-[0_0_24px_rgba(255,69,0,0.15)]">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
        ⚡ Trigger
      </p>
      <p className="font-mono text-sm font-semibold text-foreground">
        {meta?.label}
      </p>
      {trigger.value && (
        <p className="mt-1 font-mono text-sm font-bold text-[#FF4500]">
          &ldquo;{trigger.value}&rdquo;
        </p>
      )}
    </div>
  );
}

function StepNode({
  step,
  index,
}: {
  step: WorkflowStep;
  index: number;
}) {
  const meta = STEP_META.find((s) => s.value === step.type);
  return (
    <div
      className={cn(
        'w-full border-2 bg-muted p-4',
        meta?.color ?? 'border-border'
      )}
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {meta?.icon} Step {index + 1}: {meta?.label}
      </p>
      {step.type === 'add_tag' && step.config.tag && (
        <p className="font-mono text-sm font-semibold text-foreground">
          Tag:{' '}
          <span className="text-violet-500">&ldquo;{step.config.tag}&rdquo;</span>
        </p>
      )}
      {step.type === 'auto_reply' && step.config.message && (
        <p className="line-clamp-2 font-mono text-sm text-foreground">
          {step.config.message}
        </p>
      )}
      {step.type === 'escalate' && (
        <p className="font-mono text-sm font-semibold text-red-500">
          Mark thread as escalated
        </p>
      )}
      {step.type === 'webhook' && step.config.url && (
        <p className="truncate font-mono text-sm text-foreground">
          {step.config.url}
        </p>
      )}
    </div>
  );
}

// ─── Step editor ─────────────────────────────────────────────────────────────

function StepEditor({
  step,
  onChange,
  onRemove,
}: {
  step: WorkflowStep;
  onChange(s: WorkflowStep): void;
  onRemove(): void;
}) {
  const meta = STEP_META.find((s) => s.value === step.type);
  return (
    <div
      className={cn(
        'space-y-3 border-2 p-4',
        meta?.color ?? 'border-border'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {meta?.icon} {meta?.label}
        </span>
        <button
          onClick={onRemove}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Remove step"
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>
      {step.type === 'add_tag' && (
        <input
          type="text"
          value={step.config.tag ?? ''}
          onChange={(e) =>
            onChange({ ...step, config: { ...step.config, tag: e.target.value } })
          }
          placeholder="Tag name (e.g. billing, urgent)"
          className={inputCls}
        />
      )}
      {step.type === 'auto_reply' && (
        <textarea
          rows={3}
          value={step.config.message ?? ''}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, message: e.target.value },
            })
          }
          placeholder="Reply message sent to the customer…"
          className={`${inputCls} resize-y`}
        />
      )}
      {step.type === 'escalate' && (
        <p className="font-mono text-xs text-muted-foreground">
          Adds the &ldquo;escalated&rdquo; tag to the thread automatically.
        </p>
      )}
      {step.type === 'webhook' && (
        <input
          type="url"
          value={step.config.url ?? ''}
          onChange={(e) =>
            onChange({ ...step, config: { ...step.config, url: e.target.value } })
          }
          placeholder="https://hooks.example.com/notify"
          className={inputCls}
        />
      )}
    </div>
  );
}

// ─── Editor state helpers ─────────────────────────────────────────────────────

type EditorState = {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
};

function defaultEditor(): EditorState {
  return {
    name: '',
    description: '',
    trigger: { type: 'subject_contains', value: '' },
    steps: [],
  };
}

function workflowToEditor(w: Workflow): EditorState {
  return {
    name: w.name,
    description: w.description ?? '',
    trigger: w.trigger,
    steps: w.steps,
  };
}

function makeStep(type: StepType): WorkflowStep {
  return { id: crypto.randomUUID(), type, config: {} };
}

// ─── Workflow editor ──────────────────────────────────────────────────────────

function WorkflowEditor({
  orgId,
  slug,
  initial,
  editingId,
  onSave,
  onCancel,
}: {
  orgId: string;
  slug: string;
  initial: EditorState;
  editingId?: string;
  onSave(w: Workflow): void;
  onCancel(): void;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<EditorState>(initial);
  const [saving, setSaving] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);

  const triggerMeta = TRIGGER_META.find((t) => t.value === state.trigger.type);

  const handleSave = async () => {
    if (!state.name.trim()) return;
    setSaving(true);

    const payload = {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      trigger: state.trigger,
      steps: state.steps,
    };

    const { data, error } = editingId
      ? await updateWorkflow(editingId, payload, slug)
      : await createWorkflow(orgId, payload, slug);

    setSaving(false);

    if (error || !data) {
      toast.error(
        editingId ? 'Failed to update workflow' : 'Failed to create workflow',
        { description: error?.message }
      );
      return;
    }

    toast.success(editingId ? 'Workflow updated' : 'Workflow created');
    await queryClient.invalidateQueries({ queryKey: workflowsQueryKey(orgId) });
    onSave({
      ...data,
      trigger: data.trigger as unknown as WorkflowTrigger,
      steps: (data.steps as unknown as WorkflowStep[]) ?? [],
    });
  };

  const updateStep = (id: string, updated: WorkflowStep) =>
    setState((s) => ({
      ...s,
      steps: s.steps.map((step) => (step.id === id ? updated : step)),
    }));

  const removeStep = (id: string) =>
    setState((s) => ({ ...s, steps: s.steps.filter((step) => step.id !== id) }));

  const addStep = (type: StepType) => {
    setState((s) => ({ ...s, steps: [...s.steps, makeStep(type)] }));
    setShowAddStep(false);
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 md:p-6 space-y-6">
      {/* Name */}
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// NAME'}
        </p>
        <input
          type="text"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          placeholder="e.g. Auto-tag billing emails"
          className={inputCls}
        />
        <input
          type="text"
          value={state.description}
          onChange={(e) =>
            setState((s) => ({ ...s, description: e.target.value }))
          }
          placeholder="Description (optional)"
          className={inputCls}
        />
      </div>

      {/* Trigger */}
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// TRIGGER'}
        </p>
        <select
          value={state.trigger.type}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              trigger: { type: e.target.value as TriggerType, value: '' },
            }))
          }
          className={selectCls}
        >
          {TRIGGER_META.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {triggerMeta?.hasValue && (
          <input
            type="text"
            value={state.trigger.value}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                trigger: { ...s.trigger, value: e.target.value },
              }))
            }
            placeholder={triggerMeta.placeholder}
            className={inputCls}
          />
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// STEPS'}
        </p>
        {state.steps.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground">
            No steps yet — add at least one below.
          </p>
        )}
        {state.steps.map((step) => (
          <StepEditor
            key={step.id}
            step={step}
            onChange={(updated) => updateStep(step.id, updated)}
            onRemove={() => removeStep(step.id)}
          />
        ))}

        {/* Add step dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAddStep((v) => !v)}
            className="w-full border border-dashed border-[#FF4500]/40 py-2.5 text-center font-mono text-xs font-semibold text-[#FF4500]/60 transition-colors hover:border-[#FF4500] hover:text-[#FF4500]"
          >
            <PlusIcon className="mr-1 inline" />
            Add Step
          </button>
          {showAddStep && (
            <div className="absolute left-0 right-0 z-10 mt-1 border border-[#FF4500]/40 bg-background shadow-xl">
              {STEP_META.map((s) => (
                <button
                  key={s.value}
                  onClick={() => addStep(s.value)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-mono text-sm text-foreground transition-colors hover:bg-muted hover:text-[#FF4500]"
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="neutral" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !state.name.trim()}
          className="flex-1"
        >
          {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

// ─── Workflow detail (pipeline view) ─────────────────────────────────────────

function WorkflowDetail({
  workflow,
  orgId,
  slug,
  onEdit,
  onDelete,
  onToggle,
}: {
  workflow: Workflow;
  orgId: string;
  slug: string;
  onEdit(): void;
  onDelete(): void;
  onToggle(enabled: boolean): void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
            {'// WORKFLOW'}
          </p>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-foreground">
            {workflow.name}
          </h2>
          {workflow.description && (
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {workflow.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Enable / disable toggle */}
          <button
            role="switch"
            aria-checked={workflow.enabled}
            onClick={() => onToggle(!workflow.enabled)}
            title={workflow.enabled ? 'Disable workflow' : 'Enable workflow'}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500]',
              workflow.enabled
                ? 'border-[#FF4500] bg-[#FF4500]'
                : 'border-[#FF4500]/30 bg-background'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block size-4 border-2 bg-white shadow-sm transition-transform',
                workflow.enabled
                  ? 'translate-x-5 border-white'
                  : 'translate-x-0.5 border-[#FF4500]/40'
              )}
            />
          </button>

          <Button variant="neutral" size="sm" onClick={onEdit}>
            <Pencil1Icon className="mr-1 size-3.5" />
            Edit
          </Button>

          {!confirmDelete ? (
            <Button
              variant="neutral"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-destructive hover:border-destructive hover:text-destructive"
            >
              <TrashIcon className="mr-1 size-3.5" />
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-muted-foreground">
                Sure?
              </span>
              <Button
                size="sm"
                onClick={onDelete}
                className="bg-destructive border-destructive hover:bg-destructive/80"
              >
                Yes
              </Button>
              <Button
                variant="neutral"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {'// PIPELINE'}
        </p>
        <div className="flex max-w-lg flex-col items-stretch">
          <TriggerNode trigger={workflow.trigger} />
          {workflow.steps.length === 0 && (
            <>
              <PipelineConnector />
              <div className="w-full border border-dashed border-[#FF4500]/20 py-8 text-center font-mono text-xs text-muted-foreground">
                No steps — click Edit to add pipeline steps.
              </div>
            </>
          )}
          {workflow.steps.map((step, i) => (
            <div key={step.id}>
              <PipelineConnector />
              <StepNode step={step} index={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Mode = 'view' | 'create' | 'edit';

interface Props {
  orgId: string;
  slug: string;
  initialWorkflows: Workflow[];
}

export function WorkflowsPage({ orgId, slug, initialWorkflows }: Props) {
  const queryClient = useQueryClient();

  const { data: workflows = initialWorkflows } = useQuery<Workflow[]>({
    queryKey: workflowsQueryKey(orgId),
    queryFn: () => fetchWorkflows(orgId),
    initialData: initialWorkflows,
  });

  const [selectedId, setSelectedId] = useState<string | null>(
    initialWorkflows[0]?.id ?? null
  );
  const [mode, setMode] = useState<Mode>(
    initialWorkflows.length === 0 ? 'create' : 'view'
  );

  const selected = workflows.find((w) => w.id === selectedId) ?? null;

  const handleToggle = async (workflowId: string, enabled: boolean) => {
    const { error } = await toggleWorkflow(workflowId, enabled, slug);
    if (error) {
      toast.error('Failed to update workflow');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: workflowsQueryKey(orgId) });
  };

  const handleDelete = async (workflowId: string) => {
    const { error } = await deleteWorkflow(workflowId, slug);
    if (error) {
      toast.error('Failed to delete workflow', { description: error.message });
      return;
    }
    toast.success('Workflow deleted');
    await queryClient.invalidateQueries({ queryKey: workflowsQueryKey(orgId) });
    const remaining = workflows.filter((w) => w.id !== workflowId);
    const nextId = remaining[0]?.id ?? null;
    setSelectedId(nextId);
    setMode(remaining.length === 0 ? 'create' : 'view');
  };

  const handleSaved = (w: Workflow) => {
    setSelectedId(w.id);
    setMode('view');
  };

  const handleMobileBack = () => {
    if (mode === 'create' || mode === 'edit') {
      setSelectedId(workflows[0]?.id ?? null);
      setMode('view');
    } else {
      setSelectedId(null);
    }
  };

  const startCreate = () => {
    setSelectedId(null);
    setMode('create');
  };

  // On mobile: show list panel when nothing is focused; show right panel when focused
  const mobileShowList = mode === 'view' && !selected;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#FF4500]/20 px-4 md:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
            {'// AUTOMATIONS'}
          </p>
          <h1 className="font-display text-lg font-black uppercase leading-none tracking-tight text-foreground">
            Workflows
          </h1>
        </div>
        <Button onClick={startCreate} size="sm">
          <PlusIcon className="mr-2" />
          New Workflow
        </Button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel – workflow list (full-width on mobile when showing list, hidden on mobile when detail/editor is shown) */}
        <div
          className={cn(
            'shrink-0 overflow-y-auto border-r border-[#FF4500]/20 bg-muted/20',
            mobileShowList
              ? 'w-full md:w-72'
              : 'hidden md:block md:w-72'
          )}
        >
          {workflows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                No workflows yet.
              </p>
              <Button size="sm" onClick={startCreate}>
                Create first
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-[#FF4500]/10">
              {workflows.map((w) => {
                const isSelected =
                  w.id === selectedId && mode !== 'create';
                const tMeta = TRIGGER_META.find(
                  (t) => t.value === w.trigger.type
                );
                return (
                  <li key={w.id}>
                    <button
                      onClick={() => {
                        setSelectedId(w.id);
                        setMode('view');
                      }}
                      className={cn(
                        'w-full p-4 text-left transition-colors hover:bg-muted',
                        isSelected &&
                          'border-l-2 border-[#FF4500] bg-muted'
                      )}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="font-mono text-sm font-semibold leading-tight text-foreground">
                          {w.name}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 shrink-0 px-1.5 py-0.5 font-mono text-[9px] font-bold',
                            w.enabled
                              ? 'bg-[#FF4500] text-white'
                              : 'border border-[#FF4500]/30 text-muted-foreground'
                          )}
                        >
                          {w.enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        ⚡ {tMeta?.label}
                        {w.trigger.value
                          ? ` "${w.trigger.value}"`
                          : ''}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {w.steps.length} step
                        {w.steps.length !== 1 ? 's' : ''}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right panel (full-width on mobile when detail/editor active, hidden on mobile when showing list) */}
        <div
          className={cn(
            'overflow-hidden',
            mobileShowList ? 'hidden md:flex md:flex-1' : 'flex flex-1 flex-col'
          )}
        >
          {/* Mobile back button */}
          <button
            onClick={handleMobileBack}
            className="flex items-center gap-1.5 border-b border-[#FF4500]/20 px-4 py-3 font-mono text-xs text-muted-foreground transition-colors hover:text-[#FF4500] md:hidden"
          >
            <ArrowLeftIcon className="size-3" />
            Back to workflows
          </button>
          <div className="flex-1 overflow-hidden">
          {mode === 'create' && (
            <WorkflowEditor
              orgId={orgId}
              slug={slug}
              initial={defaultEditor()}
              onSave={handleSaved}
              onCancel={() => {
                const first = workflows[0];
                if (first) {
                  setSelectedId(first.id);
                  setMode('view');
                }
              }}
            />
          )}
          {mode === 'edit' && selected && (
            <WorkflowEditor
              orgId={orgId}
              slug={slug}
              initial={workflowToEditor(selected)}
              editingId={selected.id}
              onSave={handleSaved}
              onCancel={() => setMode('view')}
            />
          )}
          {mode === 'view' && selected && (
            <WorkflowDetail
              workflow={selected}
              orgId={orgId}
              slug={slug}
              onEdit={() => setMode('edit')}
              onDelete={() => handleDelete(selected.id)}
              onToggle={(enabled) => handleToggle(selected.id, enabled)}
            />
          )}
          {mode === 'view' && !selected && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
                {'// SELECT A WORKFLOW'}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                Choose a workflow from the list or create a new one.
              </p>
              <Button onClick={startCreate}>
                <PlusIcon className="mr-2" />
                New Workflow
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
