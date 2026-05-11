import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { VettingSchema } from "@/lib/schemas";

function parseVettingPayload(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return VettingSchema.parse(parsed);
    } catch {
      // Try next parsing strategy.
    }
  }

  throw new Error("Could not parse model response as VettingSchema JSON");
}

export async function POST(req: NextRequest) {
  try {
    const { requestId, contractors, repairType, city } = await req.json();

    if (!requestId || !contractors || !repairType || !city) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Sort by rating desc, get top 3
    const top3 = contractors
      .sort((a: any, b: any) => parseFloat(b.rating || '0') - parseFloat(a.rating || '0'))
      .slice(0, 3);

    // Call Gemini with Google Search tool for grounding in parallel
    const vettedResults = await Promise.all(
      top3.map(async (contractor: any) => {
        try {
          const { text } = await generateText({
            model: google("gemini-2.5-flash"),
            tools: {
              google_search: google.tools.googleSearch({})
            },
            system: "You must respond with valid JSON matching the VettingSchema exactly. Do not include markdown blocks.",
            prompt: `Search for reviews, complaints, and licensing information for "${contractor.name}" in ${city}. Also find the typical cost range for "${repairType}" in ${city}. Report findings with source URLs. Flag any red flags (complaints, lawsuits, licensing issues).
            
            JSON Schema required:
            {
              "review_summary": "string",
              "red_flags": ["string"],
              "estimated_cost_low": number,
              "estimated_cost_high": number,
              "sources": ["string url"]
            }`,
          });
          const object = parseVettingPayload(text);
          return { ...contractor, ...object };
        } catch (error) {
          console.error(`Error vetting ${contractor.name}:`, error);
          // Fallback if AI fails for one contractor
          return {
            ...contractor,
            review_summary: "Error fetching verified reviews.",
            red_flags: ["Could not verify contractor status automatically."],
            estimated_cost_low: 0,
            estimated_cost_high: 0,
            sources: []
          };
        }
      })
    );

    // Sort: 0 red flags preferenced
    const sortedVetted = vettedResults.sort((a, b) => {
      const aFlags = a.red_flags?.length || 0;
      const bFlags = b.red_flags?.length || 0;
      if (aFlags === 0 && bFlags > 0) return -1;
      if (bFlags === 0 && aFlags > 0) return 1;
      return (b.rating || 0) - (a.rating || 0); // fallback to rating
    });

    const topContractor = sortedVetted[0];
    
    // Write vetting results back to Supabase
    const supabase = createAdminClient();
    
    const { error: dbError } = await supabase
      .from("maintenance_requests")
      .update({
        vetting: sortedVetted,
        estimated_cost_low: topContractor.estimated_cost_low > 0 ? topContractor.estimated_cost_low : null,
        estimated_cost_high: topContractor.estimated_cost_high > 0 ? topContractor.estimated_cost_high : null,
        // Optional: auto-assign the best vetted contractor here, or later in the work order step.
      })
      .eq("id", requestId);

    if (dbError) {
      console.error("DB Error updating vetting:", dbError);
      return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, vetting: sortedVetted });

  } catch (err: any) {
    console.error("Vetting API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
