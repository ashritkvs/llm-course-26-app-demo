"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";

export type HealthResponse = { status: "ok"; timestamp: string };

export type Workspace = {
  id: string;
  user_id: string;
  title: string;
  course_code: string | null;
  description: string | null;
  document_count?: number;
  profile_status?: string;
  created_at: string;
  updated_at: string;
};

export type DocumentProcessingStatus =
  | "uploaded"
  | "parsing"
  | "parsed"
  | "indexed"
  | "ready"
  | "failed";

export type DocumentSourceType =
  | "prior_exam"
  | "homework"
  | "lecture_slides"
  | "practice_test"
  | "notes";

export type Document = {
  id: string;
  workspace_id: string;
  source_type: DocumentSourceType;
  file_name: string;
  upload_label: string | null;
  file_path: string;
  processing_status: DocumentProcessingStatus;
  created_at: string;
  updated_at: string;
};

export type EvidenceStrength = "low" | "medium" | "high";

export type DifficultyLabel = "easy" | "moderate" | "moderate-hard" | "hard";

export type DifficultyAxisLevel = "low" | "moderate" | "high";

export type ProfileQuestionType = "mcq" | "frq" | "calculation" | "proof" | "mixed";

export type TopicWeight = {
  topic_label: string;
  weight: number;
  evidence_strength: EvidenceStrength;
  rationale: string;
};

export type TopicDistribution = {
  summary: string;
  topics: TopicWeight[];
};

export type QuestionTypeWeight = {
  question_type: ProfileQuestionType;
  weight: number;
  evidence_strength: EvidenceStrength;
  rationale: string;
};

export type QuestionTypeDistribution = {
  summary: string;
  question_types: QuestionTypeWeight[];
};

export type DifficultyAxis = {
  level: DifficultyAxisLevel;
  rationale: string;
};

export type DifficultyProfile = {
  estimated_level: DifficultyLabel;
  confidence: EvidenceStrength;
  calculation_intensity: DifficultyAxis;
  conceptual_intensity: DifficultyAxis;
  multi_step_reasoning: DifficultyAxis;
  time_pressure: DifficultyAxis;
  summary: string;
};

export type ExamStructureProfile = {
  minimum_question_count: number;
  typical_question_count: number;
  maximum_question_count: number;
  section_patterns: string[];
  tendency_notes: string[];
  answer_format_expectations: string[];
  summary: string;
};

export type SourceEvidenceCount = {
  source_type: DocumentSourceType;
  document_count: number;
  chunk_count: number;
};

export type EvidenceSummary = {
  total_documents: number;
  total_chunks: number;
  source_counts: SourceEvidenceCount[];
  retrieved_document_ids: string[];
  retrieved_chunk_ids: string[];
  retrieval_query: string;
  evidence_characterization: string;
};

export type ProfessorProfile = {
  id: string;
  workspace_id: string;
  version: number;
  topic_distribution: TopicDistribution;
  question_type_distribution: QuestionTypeDistribution;
  difficulty_profile: DifficultyProfile;
  exam_structure_profile: ExamStructureProfile;
  evidence_summary: EvidenceSummary;
  created_at: string;
  updated_at: string;
};

// --- Generation types ---

export type GenerationRequestType = "practice_set" | "simulated_exam" | "targeted_regeneration";

export type GenerationFormatType = "mcq" | "frq" | "mixed";

export type GenerationDifficulty = "easy" | "moderate" | "moderate-hard" | "hard";

export type GenerationQuestionType = "mcq" | "frq" | "calculation" | "proof";

export type GenerationConfig = {
  question_count: number;
  format_type: GenerationFormatType;
  difficulty: GenerationDifficulty;
  question_types: GenerationQuestionType[];
};

export type ScopeConstraints = {
  topics?: string[];
  document_ids?: string[];
  custom_prompt?: string;
};

export type GenerationRequestCreate = {
  request_type: GenerationRequestType;
  generation_config: GenerationConfig;
  scope_constraints?: ScopeConstraints;
};

export type GenerationRequestStatus = "queued" | "running" | "completed" | "failed";

export type GenerationRequestRead = {
  id: string;
  workspace_id: string;
  status: GenerationRequestStatus;
  generated_exam_id?: string | null;
  error_message?: string | null;
  created_at: string;
};

export type GeneratedExamSummary = {
  id: string;
  title: string;
  exam_mode: string;
  format_type: string;
  created_at: string;
};

export type ExamQuestionOption = string;

export type ExamQuestion = {
  id: string;
  question_order: number;
  question_text: string;
  question_type: string;
  difficulty_label: string;
  topic_label: string;
  options?: ExamQuestionOption[] | null;
  answer_key?: string | null;
  explanation?: string | null;
};

export type GeneratedExamDetail = {
  id: string;
  title: string;
  exam_mode: string;
  format_type: string;
  questions: ExamQuestion[];
  created_at: string;
};

// --- Submission & Grading types ---

export type SubmissionStatus = "submitted" | "grading" | "graded" | "failed";

export type CorrectnessLabel = "correct" | "partial" | "incorrect";

export type ErrorSeverity = "minor" | "moderate" | "major";

export type AnswerItem = {
  question_id: string;
  answer_content: string;
};

export type SubmissionCreatePayload = {
  answers: AnswerItem[];
};

export type SubmissionCreatedResponse = {
  id: string;
  status: SubmissionStatus;
  created_at: string;
};

export type ErrorClassification = {
  id: string;
  error_type: string;
  description: string | null;
  severity: ErrorSeverity | null;
};

export type GradingResult = {
  id: string;
  question_id: string;
  correctness_label: CorrectnessLabel;
  score_value: number;
  points_possible: number;
  diagnostic_explanation: string | null;
  concept_label: string | null;
  error_classifications: ErrorClassification[];
};

export type SubmissionAnswer = {
  id: string;
  question_id: string;
  answer_content: string;
  grading_result: GradingResult | null;
};

export type SubmissionRead = {
  id: string;
  workspace_id: string;
  generated_exam_id: string;
  status: SubmissionStatus;
  overall_score: number | null;
  total_possible: number | null;
  submitted_at: string | null;
  created_at: string;
  answers: SubmissionAnswer[];
};

// --- Analytics types ---

export type MasteryLevel = "not_started" | "developing" | "proficient" | "strong";

export type ConceptMasteryRead = {
  score: number;
  level: MasteryLevel;
};

export type PerformanceTrendRead = {
  session: number;
  score: number;
};

export type RecommendationRead = {
  concept: string;
  reason: string;
};

export type AnalyticsResponse = {
  concept_mastery: Record<string, ConceptMasteryRead>;
  error_distribution: Record<string, number>;
  performance_trend: PerformanceTrendRead[];
  recommendations: RecommendationRead[];
};

// --- Regeneration types ---

export type RegenerationStatus = "queued" | "running" | "completed" | "failed";

export type RegenerationRequestCreate = {
  target_concepts: string[];
  question_count?: number;
  format_type?: "mcq" | "frq" | "mixed";
};

export type RegenerationRequestResponse = {
  id: string;
  workspace_id: string;
  status: RegenerationStatus;
  target_concepts: string[];
  generated_exam_id: string | null;
  created_at: string;
};

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new ApiError("Unable to read auth session", 401, error);
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Not authenticated", 401);
  return token;
}

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const auth = init?.auth ?? true;
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");

  if (auth) {
    const token = await getAccessToken();
    headers.set("authorization", `Bearer ${token}`);
  }

  const resp = await fetch(url, { ...init, headers });
  const contentType = resp.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await resp.json().catch(() => null) : await resp.text().catch(() => "");

  if (!resp.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? (body as { detail: unknown }).detail
        : body;
    throw new ApiError(`Request failed: ${resp.status}`, resp.status, detail);
  }

  return body as T;
}

export const apiClient = {
  getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/health", { auth: false });
  },

  createWorkspace(input: {
    title: string;
    course_code?: string | null;
    description?: string | null;
  }): Promise<Workspace> {
    return request<Workspace>("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  listWorkspaces(): Promise<Workspace[]> {
    return request<Workspace[]>("/api/workspaces");
  },

  getWorkspace(id: string): Promise<Workspace> {
    return request<Workspace>(`/api/workspaces/${encodeURIComponent(id)}`);
  },

  updateWorkspace(
    id: string,
    input: { title?: string; course_code?: string | null; description?: string | null },
  ): Promise<Workspace> {
    return request<Workspace>(`/api/workspaces/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  deleteWorkspace(id: string): Promise<void> {
    return request<void>(`/api/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  uploadDocument(input: {
    workspaceId: string;
    file: File;
    source_type: DocumentSourceType;
    upload_label?: string;
    onProgress?: (percent: number) => void;
  }): Promise<Document> {
    const form = new FormData();
    form.append("file", input.file);
    form.append("source_type", input.source_type);
    if (input.upload_label) form.append("upload_label", input.upload_label);

    return new Promise<Document>(async (resolve, reject) => {
      try {
        const token = await getAccessToken();
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${getBaseUrl()}/api/workspaces/${encodeURIComponent(input.workspaceId)}/documents`,
        );
        xhr.setRequestHeader("accept", "application/json");
        xhr.setRequestHeader("authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || !input.onProgress) {
            return;
          }

          input.onProgress(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
          const contentType = xhr.getResponseHeader("content-type") ?? "";
          const isJson = contentType.includes("application/json");
          let body: unknown = null;

          if (xhr.responseText) {
            if (isJson) {
              try {
                body = JSON.parse(xhr.responseText);
              } catch {
                body = xhr.responseText;
              }
            } else {
              body = xhr.responseText;
            }
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            if (input.onProgress) {
              input.onProgress(100);
            }
            resolve(body as Document);
            return;
          }

          const detail =
            typeof body === "object" && body !== null && "detail" in body
              ? (body as { detail: unknown }).detail
              : body;
          reject(new ApiError(`Request failed: ${xhr.status}`, xhr.status, detail));
        };

        xhr.onerror = () => {
          reject(new ApiError("Network error", 500, "Upload failed"));
        };

        xhr.send(form);
      } catch (error) {
        reject(error);
      }
    });
  },

  listDocuments(workspaceId: string): Promise<Document[]> {
    return request<Document[]>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/documents`,
    );
  },

  getDocument(workspaceId: string, documentId: string): Promise<Document> {
    return request<Document>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(documentId)}`,
    );
  },

  deleteDocument(workspaceId: string, documentId: string): Promise<void> {
    return request<void>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" },
    );
  },

  getProfessorProfile(workspaceId: string): Promise<ProfessorProfile> {
    return request<ProfessorProfile>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/profile`,
    );
  },

  generateProfessorProfile(workspaceId: string): Promise<ProfessorProfile> {
    return request<ProfessorProfile>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/profile/generate`,
      { method: "POST" },
    );
  },

  postGenerationRequest(
    workspaceId: string,
    body: GenerationRequestCreate,
  ): Promise<GenerationRequestRead> {
    return request<GenerationRequestRead>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/generation-requests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },

  getGenerationRequest(
    workspaceId: string,
    requestId: string,
  ): Promise<GenerationRequestRead> {
    return request<GenerationRequestRead>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/generation-requests/${encodeURIComponent(requestId)}`,
    );
  },

  getExams(workspaceId: string): Promise<GeneratedExamSummary[]> {
    return request<GeneratedExamSummary[]>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/exams`,
    );
  },

  getExamDetail(workspaceId: string, examId: string): Promise<GeneratedExamDetail> {
    return request<GeneratedExamDetail>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/exams/${encodeURIComponent(examId)}`,
    );
  },

  createSubmission(
    workspaceId: string,
    examId: string,
    body: SubmissionCreatePayload,
  ): Promise<SubmissionCreatedResponse> {
    return request<SubmissionCreatedResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/exams/${encodeURIComponent(examId)}/submissions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },

  getSubmission(
    workspaceId: string,
    submissionId: string,
  ): Promise<SubmissionRead> {
    return request<SubmissionRead>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/submissions/${encodeURIComponent(submissionId)}`,
    );
  },

  getAnalytics(workspaceId: string): Promise<AnalyticsResponse> {
    return request<AnalyticsResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/analytics`,
    );
  },

  postRegenerationRequest(
    workspaceId: string,
    body: RegenerationRequestCreate,
  ): Promise<RegenerationRequestResponse> {
    return request<RegenerationRequestResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/regeneration-requests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  },

  getRegenerationRequest(
    workspaceId: string,
    requestId: string,
  ): Promise<RegenerationRequestResponse> {
    return request<RegenerationRequestResponse>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/regeneration-requests/${encodeURIComponent(requestId)}`,
    );
  },

  async exportExamPdf(
    workspaceId: string,
    examId: string,
    mode: "questions" | "solutions" = "questions",
  ): Promise<Blob> {
    const url = `${getBaseUrl()}/api/workspaces/${encodeURIComponent(workspaceId)}/exams/${encodeURIComponent(examId)}/export?mode=${encodeURIComponent(mode)}`;
    const token = await getAccessToken();
    const resp = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "Export failed");
      throw new ApiError(`Export failed: ${resp.status}`, resp.status, detail);
    }
    return resp.blob();
  },
};
