import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAiGateway } from 'ai-gateway-provider';
import { createGoogleGenerativeAI as createGoogle } from 'ai-gateway-provider/providers/google';

const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cfGatewayName = 'default';
const cfAigToken = process.env.CF_AIG_TOKEN;

function buildTextModel() {
  const aigateway = createAiGateway({
    accountId: cfAccountId!,
    gateway: cfGatewayName!,
    ...(cfAigToken && { apiKey: cfAigToken }),
  });
  const gatewayGoogle = createGoogle({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  return aigateway(gatewayGoogle('gemini-2.5-flash'));
}

/**
 * Embedding model — must match the dimensionality stored in pgvector.
 * Changing this model requires re-indexing all existing sections.
 *
 * When CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_GATEWAY_NAME are set, embedding
 * requests are also routed through Cloudflare AI Gateway via a custom base
 * URL (createAiGateway only wraps language models, not embedding models).
 */
function buildEmbeddingModel() {
  // Route embeddings through CF gateway by pointing the base URL at the
  // gateway's Google AI Studio endpoint.
  const provider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${cfAccountId}/${cfGatewayName}/google-ai-studio/v1beta`,
    ...(cfAigToken && {
      headers: { 'cf-aig-authorization': `Bearer ${cfAigToken}` },
    }),
  });
  return provider.embeddingModel('gemini-embedding-001');
}

export const textModel = buildTextModel();
export const embeddingModel = buildEmbeddingModel();
