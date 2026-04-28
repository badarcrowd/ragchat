import { generateObject } from "ai";
import { z } from "zod";
import { getSmallModel } from "@/lib/ai/openai";
import type { RetrievedChunk } from "@/lib/types";

export type RankedChunk = RetrievedChunk & {
  rerankScore: number;
  rerankReason?: string;
};

/**
 * Re-rank chunks using LLM-based relevance scoring
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK: number = 5
): Promise<RankedChunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  // If we have few chunks, just return them with similarity as rerank score
  if (chunks.length <= topK) {
    return chunks.map((chunk) => ({
      ...chunk,
      rerankScore: chunk.similarity
    }));
  }

  try {
    // Prepare chunks for re-ranking
    const chunkTexts = chunks.map((chunk, index) => ({
      index,
      preview: chunk.content.slice(0, 300) + (chunk.content.length > 300 ? "..." : "")
    }));

    const { object } = await generateObject({
      model: getSmallModel(),
      schema: z.object({
        rankings: z.array(
          z.object({
            chunk_index: z.number(),
            relevance_score: z.number().min(0).max(1),
            reason: z.string().optional()
          })
        )
      }),
      prompt: `You are a relevance scoring system. Given a user query and a list of text chunks, score each chunk's relevance to answering the query.

User Query: ${query}

Text Chunks:
${chunkTexts.map((c) => `[${c.index}] ${c.preview}`).join("\n\n")}

Score each chunk from 0.0 (completely irrelevant) to 1.0 (perfectly relevant).
Consider:
- Direct answer to the query
- Supporting context
- Factual accuracy indicators
- Completeness of information

Return rankings for all ${chunks.length} chunks.`,
      temperature: 0
    });

    // Combine original similarity with rerank score
    const rankedChunks: RankedChunk[] = chunks.map((chunk, index) => {
      const ranking = object.rankings.find((r) => r.chunk_index === index);
      const rerankScore = ranking
        ? // Weighted combination: 40% vector similarity, 60% LLM rerank
          chunk.similarity * 0.4 + ranking.relevance_score * 0.6
        : chunk.similarity;

      return {
        ...chunk,
        rerankScore,
        rerankReason: ranking?.reason
      };
    });

    // Sort by rerank score and take top K
    return rankedChunks
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);
  } catch (error) {
    console.error("[Rerank Error]", error);
    // Fall back to original similarity ranking
    return chunks.slice(0, topK).map((chunk) => ({
      ...chunk,
      rerankScore: chunk.similarity
    }));
  }
}

/**
 * Lightweight re-ranking using reciprocal rank fusion (no LLM calls)
 * Useful when you want to combine multiple retrieval strategies
 */
export function reciprocalRankFusion(
  rankedLists: RetrievedChunk[][],
  k: number = 60
): RetrievedChunk[] {
  const scoreMap = new Map<string, { chunk: RetrievedChunk; score: number }>();

  rankedLists.forEach((list) => {
    list.forEach((chunk, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      const existing = scoreMap.get(chunk.id);

      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(chunk.id, {
          chunk,
          score: rrfScore
        });
      }
    });
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.chunk);
}

/**
 * Diversity-based re-ranking to avoid redundant chunks
 */
export function diversityRerank(
  chunks: RetrievedChunk[],
  topK: number = 5,
  lambda: number = 0.5
): RetrievedChunk[] {
  if (chunks.length <= topK) {
    return chunks;
  }

  const selected: RetrievedChunk[] = [];
  const remaining = [...chunks];

  // Always select the top chunk
  selected.push(remaining.shift()!);

  // Maximal Marginal Relevance (MMR) selection
  while (selected.length < topK && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIndex = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      
      // Calculate max similarity to already selected chunks (simple word overlap)
      let maxSimilarity = 0;
      for (const selectedChunk of selected) {
        const similarity = calculateTextSimilarity(
          candidate.content,
          selectedChunk.content
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // MMR score: balance relevance and diversity
      const mmrScore =
        lambda * candidate.similarity - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

/**
 * Simple text similarity based on word overlap (Jaccard similarity)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set(
    [...words1].filter((word) => words2.has(word))
  );
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}
