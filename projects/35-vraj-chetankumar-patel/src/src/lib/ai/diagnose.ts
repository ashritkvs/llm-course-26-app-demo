import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { DiagnosisSchema, type Diagnosis } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const SYSTEM_PROMPT = `You are a property maintenance diagnostic agent. Analyze the provided photo and optional text description to diagnose the maintenance issue.

Be specific about:
- The affected system (e.g., "kitchen sink drain pipe", not just "plumbing")
- Severity on a 1-5 scale (1 = cosmetic, 5 = safety hazard)
- Urgency level (low, medium, high, emergency)
- A clear recommended action the contractor should take
- A tenant safety note if severity >= 4 (e.g., "Turn off water supply valve immediately")

If you cannot determine the issue from the photo, set confidence below 0.6.`;

export async function diagnoseFromPhoto(
  photoBuffer: Buffer,
  description?: string | null
): Promise<Diagnosis> {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: DiagnosisSchema,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image", image: photoBuffer },
          {
            type: "text",
            text: description || "Diagnose this maintenance issue.",
          },
        ],
      },
    ],
  });

  return object;
}

export async function runDiagnosis(requestId: string): Promise<Diagnosis> {
  const supabase = createAdminClient();

  const { data: request, error: fetchError } = await supabase
    .from("maintenance_requests")
    .select("photo_url, description")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    throw new Error(
      `Failed to fetch request ${requestId}: ${fetchError?.message}`
    );
  }

  const photoResponse = await fetch(request.photo_url);
  if (!photoResponse.ok) {
    throw new Error(
      `Failed to download photo: ${photoResponse.status} ${photoResponse.statusText}`
    );
  }
  const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());

  const diagnosis = await diagnoseFromPhoto(photoBuffer, request.description);

  const diagnosisData: Record<string, unknown> = { ...diagnosis };
  if (diagnosis.confidence < 0.6) {
    diagnosisData.needs_review = true;
  }

  const { error: updateError } = await supabase
    .from("maintenance_requests")
    .update({
      diagnosis: diagnosisData,
      status: "diagnosed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    throw new Error(
      `Failed to update request ${requestId}: ${updateError.message}`
    );
  }

  return diagnosis;
}
