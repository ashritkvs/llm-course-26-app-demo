export type TriggerType = 'subject_contains' | 'sender_domain' | 'any_email' | 'has_tag';
export type StepType = 'add_tag' | 'auto_reply' | 'escalate' | 'webhook';

export type WorkflowTrigger = {
  type: TriggerType;
  value: string;
};

export type WorkflowStep = {
  id: string;
  type: StepType;
  config: { tag?: string; message?: string; url?: string };
};

export type Workflow = {
  id: string;
  created_at: string;
  organization_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
};
