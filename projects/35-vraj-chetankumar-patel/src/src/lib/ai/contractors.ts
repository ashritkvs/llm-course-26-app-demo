import { generateText, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  ContractorSchema,
  type Contractor,
  ISSUE_CATEGORIES,
} from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_CATEGORIES = new Set<string>(ISSUE_CATEGORIES);

function categoryToSearchTerm(category: string): string {
  const map: Record<string, string> = {
    plumbing: "licensed plumber",
    electrical: "licensed electrician",
    hvac: "HVAC technician",
    structural: "structural repair contractor",
    appliance: "appliance repair technician",
    pest: "pest control service",
    cosmetic: "general handyman",
  };
  return map[category] ?? `${category} contractor`;
}

async function findContractorsWithMaps(
  category: string,
  address: string,
  radiusMiles: number = 10
): Promise<Contractor[]> {
  const searchTerm = categoryToSearchTerm(category);

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    tools: {
      google_maps: google.tools.googleMaps({}),
    },
    prompt: `Find ${searchTerm} contractors within ${radiusMiles} miles of ${address}.

For each contractor, provide:
- Business name
- Full address
- Phone number
- Google Maps rating (out of 5)
- Total number of reviews
- Approximate distance in miles from the search address
- Today's business hours
- Whether they are currently open

Return at least 5 results. Prioritize businesses that are currently open and have high ratings.`,
  });

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: z.object({ contractors: z.array(ContractorSchema) }),
    prompt: `Extract contractor information from the following text into structured JSON.
If any field is missing, use reasonable defaults:
- rating: 0 if unknown
- total_reviews: 0 if unknown
- distance_miles: 0 if unknown
- hours_today: "Unknown" if not specified
- is_open_now: false if unknown
- maps_url: "" if not available

Text to extract from:
${text}`,
  });

  return object.contractors;
}

function deduplicateContractors(contractors: Contractor[]): Contractor[] {
  const seen = new Set<string>();
  return contractors.filter((c) => {
    const key = c.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortContractors(contractors: Contractor[]): Contractor[] {
  return [...contractors].sort((a, b) => {
    if (a.is_open_now !== b.is_open_now) return a.is_open_now ? -1 : 1;
    return b.rating - a.rating;
  });
}

export async function discoverContractors(
  requestId: string,
  category: string,
  address: string,
  isEmergency: boolean = false
): Promise<Contractor[]> {
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(`Invalid category: ${category}`);
  }

  let contractors = await findContractorsWithMaps(category, address);

  contractors = deduplicateContractors(contractors);
  contractors = contractors.filter((c) => c.rating >= 3.5 || c.rating === 0);

  if (isEmergency && contractors.length < 3) {
    const expanded = await findContractorsWithMaps(category, address, 25);
    const expandedDeduped = deduplicateContractors([
      ...contractors,
      ...expanded,
    ]);
    contractors = expandedDeduped.filter(
      (c) => c.rating >= 3.5 || c.rating === 0
    );
  }

  contractors = sortContractors(contractors);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("maintenance_requests")
    .update({
      contractors: contractors,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    throw new Error(
      `Failed to update contractors for request ${requestId}: ${error.message}`
    );
  }

  return contractors;
}
