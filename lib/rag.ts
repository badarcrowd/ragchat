import { createHash } from "crypto";
import { embed, embedMany } from "ai";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getEmbeddingModel } from "@/lib/ai/openai";
import { defaultTenantId } from "@/lib/env";
import type { RetrievedChunk, SourceCitation } from "@/lib/types";

const DEFAULT_TARGET_TOKENS = 750;
const DEFAULT_OVERLAP_TOKENS = 100;
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY = Number(process.env.RAG_MIN_SIMILARITY ?? 0.2);

export type IndexDocumentInput = {
  tenantId?: string;
  title?: string | null;
  sourceUrl?: string | null;
  type: "url" | "pdf" | "text";
  text: string;
  metadata?: Record<string, unknown>;
};

export function sanitizeTenantId(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return defaultTenantId();
  }
  return normalized.replace(/[^a-z0-9_.:-]/g, "-").slice(0, 160);
}

export function normalizeDomain(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const withScheme = value.includes("://") ? value : `https://${value}`;
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return value.toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, 253);
  }
}

export function normalizeText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function estimateTokens(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.3));
}

export function chunkText(
  rawText: string,
  targetTokens = DEFAULT_TARGET_TOKENS,
  overlapTokens = DEFAULT_OVERLAP_TOKENS
) {
  const text = normalizeText(rawText);
  if (!text) {
    return [];
  }

  const words = text.split(/\s+/);
  const targetWords = Math.max(120, Math.floor(targetTokens / 1.3));
  const overlapWords = Math.max(20, Math.floor(overlapTokens / 1.3));
  const step = Math.max(1, targetWords - overlapWords);
  const chunks: Array<{ content: string; tokenCount: number; position: number }> = [];

  for (let start = 0; start < words.length; start += step) {
    const content = words.slice(start, start + targetWords).join(" ").trim();
    if (estimateTokens(content) < 40 && chunks.length > 0) {
      chunks[chunks.length - 1].content += ` ${content}`;
      chunks[chunks.length - 1].tokenCount = estimateTokens(
        chunks[chunks.length - 1].content
      );
      break;
    }

    chunks.push({
      content,
      tokenCount: estimateTokens(content),
      position: chunks.length
    });

    if (start + targetWords >= words.length) {
      break;
    }
  }

  return chunks;
}

function vectorLiteral(values: number[]) {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function contentHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function embedText(text: string) {
  const result = await embed({
    model: getEmbeddingModel(),
    value: text
  });
  return result.embedding;
}

async function embedChunkBatch(chunks: string[]) {
  const result = await embedMany({
    model: getEmbeddingModel(),
    values: chunks
  });
  return result.embeddings;
}

export async function retrieveRelevantChunks(input: {
  query: string;
  tenantId?: string;
  topK?: number;
  minSimilarity?: number;
}) {
  const queryEmbedding = await embedText(input.query);
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: vectorLiteral(queryEmbedding),
    match_count: input.topK ?? DEFAULT_TOP_K,
    tenant_filter: sanitizeTenantId(input.tenantId),
    min_similarity: input.minSimilarity ?? DEFAULT_MIN_SIMILARITY
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as RetrievedChunk[];
}

export function toSourceCitations(chunks: RetrievedChunk[]): SourceCitation[] {
  const seen = new Set<string>();
  return chunks
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      url: chunk.source_url,
      similarity: chunk.similarity
    }))
    .filter((source) => {
      // Only include sources with valid URLs
      if (!source.url || source.url === '#' || source.url.trim() === '') {
        return false;
      }
      // Deduplicate by URL
      if (seen.has(source.url)) {
        return false;
      }
      seen.add(source.url);
      return true;
    });
}

export function buildContextBlock(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return "No context was retrieved.";
  }

  return chunks
    .map((chunk, index) => {
      const title = chunk.title ?? "Untitled source";
      const url = chunk.source_url ?? "No URL";
      return [
        `SOURCE ${index + 1}`,
        `Title: ${title}`,
        `URL: ${url}`,
        `Similarity: ${chunk.similarity.toFixed(3)}`,
        `Content:\n${chunk.content}`
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export function buildSystemPrompt(input: {
  systemInstructions?: string | null;
  languageName: string;
  hasContext: boolean;
}) {
  return [
    input.systemInstructions?.trim() ||
      "You are a concise, accurate support assistant. Answer only from the supplied context.",
    "Use the retrieved context as the source of truth.",
    "If the context does not contain the answer, say you do not know and offer to connect the user with a human.",
    "Do not invent facts, prices, policies, URLs, or citations.",
    "Cite sources inline using [1], [2], etc. when using retrieved context.",
    `Answer in ${input.languageName}.`,
    input.hasContext
      ? "Keep the answer helpful and compact."
      : "Because no context was retrieved, use the fallback guardrail and do not answer from general knowledge."
  ].join("\n");
}

export function buildRagUserPrompt(input: {
  originalQuestion: string;
  englishQuestion: string;
  context: string;
}) {
  return [
    "Retrieved context:",
    input.context,
    "",
    "User question translated to English:",
    input.englishQuestion,
    "",
    "Original user question:",
    input.originalQuestion
  ].join("\n");
}

export async function crawlUrl(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs can be crawled.");
  }

  // Try WordPress JSON API first (bypasses Cloudflare)
  const { isWordPressSite, fetchWordPressContentByUrl } = await import("./wordpress");
  const baseUrl = `${parsed.protocol}//${parsed.host}`;
  
  const isWP = await isWordPressSite(baseUrl);
  if (isWP) {
    console.log('[Crawler] Detected WordPress site, using JSON API');
    const wpContent = await fetchWordPressContentByUrl(url);
    
    if (wpContent) {
      console.log('[Crawler] Successfully fetched via WordPress JSON API');
      return wpContent;
    }
    
    console.log('[Crawler] WordPress API failed, falling back to HTML scraping');
  }

  // Fallback to HTML scraping
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "upgrade-insecure-requests": "1"
      },
      redirect: "follow",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorDetails = response.status === 403 
        ? "The website is blocking automated access (403 Forbidden). Try copying and pasting the content instead, or use a different URL."
        : response.status === 404
        ? "The page was not found (404). Please check the URL."
        : response.status === 429
        ? "Too many requests (429). The website is rate limiting. Try again later."
        : response.status === 503
        ? "Service temporarily unavailable (503). Try again later."
        : `HTTP ${response.status}`;
      
      throw new Error(`Cannot crawl ${url}: ${errorDetails}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (!contentType.includes("html")) {
      return {
        title: parsed.hostname,
        text: normalizeText(body),
        url: response.url
      };
    }

    // Dynamically import cheerio
    const cheerioModule = await import("cheerio");
    const $ = cheerioModule.load(body);
    
    // Remove unwanted elements
    $("script, style, noscript, svg, nav, footer, form, iframe, img").remove();

    // Extract title from multiple sources
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='twitter:title']").attr("content") ||
      $("title").first().text() ||
      $("h1").first().text() ||
      parsed.hostname;

    // Extract main content
    const text = normalizeText($("body").text());

    if (!text || text.length < 100) {
      throw new Error("Extracted content is too short or empty. The page might require JavaScript or authentication.");
    }

    return {
      title: normalizeText(title).slice(0, 240),
      text,
      url: response.url
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Crawl timeout after 30 seconds for ${url}. The website is too slow to respond.`);
      }
      throw error;
    }
    throw new Error(`Failed to crawl ${url}: ${String(error)}`);
  }
}

export async function extractPdfText(buffer: Buffer) {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default ?? pdfParseModule;
  const result = await pdfParse(buffer);
  return normalizeText(result.text);
}

export async function indexDocument(input: IndexDocumentInput) {
  const tenantId = sanitizeTenantId(input.tenantId);
  const text = normalizeText(input.text);
  if (!text) {
    throw new Error("Document text is empty after extraction.");
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("No chunks generated from document.");
  }

  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      title: input.title ?? input.sourceUrl ?? "Untitled document",
      source_url: input.sourceUrl,
      type: input.type,
      status: "queued",
      raw_text: text,
      content_hash: contentHash(text),
      metadata: input.metadata ?? {},
      chunk_count: chunks.length,
      indexed_at: null
    })
    .select("id")
    .single();

  if (documentError) {
    throw documentError;
  }

  try {
    const rows = [];
    const batchSize = 64;

    for (let start = 0; start < chunks.length; start += batchSize) {
      const batch = chunks.slice(start, start + batchSize);
      const embeddings = await embedChunkBatch(
        batch.map((chunk) => chunk.content)
      );

      for (let index = 0; index < batch.length; index += 1) {
        rows.push({
          document_id: document.id,
          tenant_id: tenantId,
          content: batch[index].content,
          token_count: batch[index].tokenCount,
          position: batch[index].position,
          source_url: input.sourceUrl,
          title: input.title ?? input.sourceUrl ?? "Untitled document",
          embedding: vectorLiteral(embeddings[index]),
          metadata: input.metadata ?? {}
        });
      }
    }

    const { error: chunksError } = await supabase.from("chunks").insert(rows);
    if (chunksError) {
      throw chunksError;
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "indexed",
        chunk_count: rows.length,
        indexed_at: now,
        updated_at: now
      })
      .eq("id", document.id);

    if (updateError) {
      throw updateError;
    }

    return {
      documentId: document.id as string,
      chunks: rows.length
    };
  } catch (error) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
        metadata: {
          ...(input.metadata ?? {}),
          error: error instanceof Error ? error.message : "Indexing failed"
        },
        updated_at: now
      })
      .eq("id", document.id);
    throw error;
  }
}

export async function reindexDocument(documentId: string) {
  const supabase = createSupabaseAdmin();
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error) {
    throw error;
  }

  await supabase.from("chunks").delete().eq("document_id", documentId);
  const chunks = chunkText(document.raw_text ?? "");
  const rows = [];

  for (let start = 0; start < chunks.length; start += 64) {
    const batch = chunks.slice(start, start + 64);
    const embeddings = await embedChunkBatch(batch.map((chunk) => chunk.content));
    for (let index = 0; index < batch.length; index += 1) {
      rows.push({
        document_id: documentId,
        tenant_id: document.tenant_id,
        content: batch[index].content,
        token_count: batch[index].tokenCount,
        position: batch[index].position,
        source_url: document.source_url,
        title: document.title,
        embedding: vectorLiteral(embeddings[index]),
        metadata: document.metadata ?? {}
      });
    }
  }

  if (rows.length > 0) {
    const { error: chunksError } = await supabase.from("chunks").insert(rows);
    if (chunksError) {
      throw chunksError;
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("documents")
    .update({
      status: "indexed",
      chunk_count: rows.length,
      indexed_at: now,
      updated_at: now
    })
    .eq("id", documentId);

  return { documentId, chunks: rows.length };
}
