import type {
  PredictRequest, PredictResponse, HealthResponse, ModelInfoResponse,
  PatientData, ExtractedReport, AuthResponse, DbHistoryItem, StreamEvent,
} from "./heartguard-types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8002";

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health/`);
  if (!res.ok) throw new Error("API unreachable");
  return res.json();
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  const res = await fetch(`${API_BASE}/health/model`);
  if (!res.ok) throw new Error("Failed to fetch model info");
  return res.json();
}

export async function getExampleData(): Promise<{ patient_data: PatientData }> {
  const res = await fetch(`${API_BASE}/predict/example`);
  if (!res.ok) throw new Error("Failed to fetch example");
  return res.json();
}

export async function predict(request: PredictRequest): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (res.status === 422) {
    const err = await res.json();
    throw new Error(JSON.stringify(err.detail || err.validation_errors || "Validation failed"));
  }
  if (!res.ok) throw new Error("Prediction failed");
  return res.json();
}

/** Stream a prediction via SSE. Calls callbacks as events arrive. Returns cleanup fn. */
export function predictStream(
  request: PredictRequest,
  callbacks: {
    onPrediction?: (data: StreamEvent & { type: "prediction" }) => void;
    onMeta?: (data: StreamEvent & { type: "meta" }) => void;
    onChunk?: (chunk: string) => void;
    onDone?: () => void;
    onError?: (msg: string) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/predict/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        callbacks.onError?.("Stream connection failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event: StreamEvent = JSON.parse(raw);
            if (event.type === "prediction") callbacks.onPrediction?.(event as any);
            else if (event.type === "meta") callbacks.onMeta?.(event as any);
            else if (event.type === "text") callbacks.onChunk?.(event.chunk);
            else if (event.type === "done") callbacks.onDone?.();
            else if (event.type === "error") callbacks.onError?.(event.message);
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") callbacks.onError?.(e.message || "Stream error");
    }
  })();

  return () => controller.abort();
}

/** Extract clinical values from a medical report image or PDF. */
export async function extractReport(file: File): Promise<ExtractedReport> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/report/extract`, { method: "POST", body: form });
  if (res.status === 415) throw new Error("Unsupported file type. Please upload a JPEG, PNG, or PDF.");
  if (res.status === 413) throw new Error("File is too large. Maximum size is 10 MB.");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to extract report data.");
  }
  return res.json();
}

// ---- Auth ----
export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Registration failed");
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data;
}

export async function savePredictionToDb(
  token: string,
  payload: { prediction_id: string; risk_probability: number; risk_level: string; patient_data: PatientData; result_data?: any }
): Promise<void> {
  await fetch(`${API_BASE}/auth/predictions/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getDbHistory(token: string): Promise<DbHistoryItem[]> {
  const res = await fetch(`${API_BASE}/auth/predictions/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load history");
  const data = await res.json();
  return data.predictions;
}
