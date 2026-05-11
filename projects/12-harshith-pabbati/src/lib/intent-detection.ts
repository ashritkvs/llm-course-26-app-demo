import { generateText } from 'ai';
import { codeBlock } from 'common-tags';

import { textModel } from '@/lib/ai';
import { parseLLMJSON } from '@/lib/parse-llm-json';

export const DEFAULT_INTENT_CATEGORIES = [
  // Core
  'Billing',
  'Bug Report',
  'Feature Request',
  'General Support',
  // Account
  'Account Access',
  'Account Settings',
  'Account Deletion',
  // Billing & Commerce
  'Refund Request',
  'Payment Failed',
  'Subscription Change',
  'Invoice Request',
  // Technical
  'Performance Issue',
  'Integration Issue',
  'Data Export',
  // Sales
  'Upgrade Inquiry',
  'Demo Request',
  // Onboarding
  'Onboarding Help',
  'How-To Question',
  // Trust & Safety
  'Security Concern',
  'Abuse Report',
  'Privacy Request',
  // Feedback
  'Complaint',
  'Compliment',
  // Noise
  'Spam / Irrelevant',
] as const;

export type IntentCategory = (typeof DEFAULT_INTENT_CATEGORIES)[number];

/**
 * Runs a fast Gemini LLM pass to classify the customer's intent and return one
 * or more matching tags from the default categories.
 *
 * Returns an empty array on failure — intent detection errors must never block
 * the main email processing pipeline.
 */
export async function detectIntent(
  subject: string,
  body: string
): Promise<string[]> {
  try {
    const { text } = await generateText({
      model: textModel,
      temperature: 0,
      maxOutputTokens: 200,
      system: codeBlock`
        You are an intent classifier for customer support tickets.
        Classify the customer's message into one or more of the following categories:
        ${DEFAULT_INTENT_CATEGORIES.join(', ')}.

        Return valid JSON only — no markdown fences, no explanation.
        Format: { "tags": ["<category>"] }

        Rules:
        - Pick 1 to 2 of the most relevant categories from the list.
        - Only use categories from the provided list.
        - When in doubt, use "General Support".
      `,
      prompt: `Subject: ${subject}\n\nMessage:\n${body}`,
    });

    const parsed = parseLLMJSON(text);
    if (Array.isArray(parsed?.tags)) {
      return (parsed.tags as unknown[]).filter(
        (t): t is string =>
          typeof t === 'string' &&
          (DEFAULT_INTENT_CATEGORIES as readonly string[]).includes(t)
      );
    }
    return [];
  } catch (err) {
    console.error('[intent-detection] Failed to classify intent:', err);
    return [];
  }
}
