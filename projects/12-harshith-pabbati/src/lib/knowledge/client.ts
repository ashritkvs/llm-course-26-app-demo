import { Database } from '@/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

export type KnowledgeConfig = {
  /** Supabase client (server or service role). */
  supabase: SupabaseClient<Database>;
  /** UUID of the organization whose knowledge base to query. */
  organizationId: string;
};

export type SectionResult = {
  id: string;
  heading: string | null;
  content: string;
  position: number;
};

export type DatasourceResult = {
  id: string;
  url: string;
};

/**
 * Low-level query client for Answerify's Supabase knowledge base.
 *
 * Use `createKnowledge()` for the high-level interface that includes AI SDK
 * tools ready to pass to `generateText` / `streamText`.
 */
export class KnowledgeClient {
  private readonly supabase: SupabaseClient<Database>;
  private readonly organizationId: string;

  constructor(config: KnowledgeConfig) {
    this.supabase = config.supabase;
    this.organizationId = config.organizationId;
  }

  /**
   * Full-text search across all sections belonging to the organization.
   * Equivalent to running `grep -r "<keyword>" .` in a file tree.
   *
   * @param keyword  Literal text to search for. Wildcards are automatically escaped.
   * @param limit    Maximum rows to return (default: 5, max: 20).
   */
  async search(keyword: string, limit = 5): Promise<SectionResult[]> {
    // Escape PostgreSQL ILIKE wildcard characters so the model's keyword is
    // treated as a literal string, not a pattern.
    const sanitised = keyword.replace(/[%_\\]/g, (c) => `\\${c}`);
    const safeLimit = Math.min(Math.max(1, limit), 20);

    const { data, error } = await this.supabase
      .from('section')
      .select('id, heading, content, position')
      .ilike('content', `%${sanitised}%`)
      .eq('organization_id', this.organizationId)
      .order('position')
      .limit(safeLimit);

    if (error) throw error;
    return (data ?? []) as SectionResult[];
  }

  /**
   * List all datasource URLs for the organization.
   * Equivalent to running `ls` on the root of a file tree.
   *
   * @param limit  Maximum number of sources to return (default: 50).
   */
  async listSources(limit = 50): Promise<DatasourceResult[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);

    const { data, error } = await this.supabase
      .from('datasource')
      .select('id, url')
      .eq('organization_id', this.organizationId)
      .limit(safeLimit);

    if (error) throw error;
    return (data ?? []) as DatasourceResult[];
  }

  /**
   * Read all content sections from a specific datasource by its URL.
   * Equivalent to running `cat <file>` on a document.
   *
   * @param url  The datasource URL to read.
   */
  async readSource(
    url: string
  ): Promise<{ datasourceId: string; sections: SectionResult[] }> {
    const { data: ds, error: dsError } = await this.supabase
      .from('datasource')
      .select('id')
      .eq('url', url)
      .eq('organization_id', this.organizationId)
      .single();

    if (dsError) throw dsError;

    const { data, error } = await this.supabase
      .from('section')
      .select('id, heading, content, position')
      .eq('datasource_id', ds.id)
      .order('position');

    if (error) throw error;
    return { datasourceId: ds.id, sections: (data ?? []) as SectionResult[] };
  }
}
