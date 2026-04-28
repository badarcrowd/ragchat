import {
  convertToModelMessages,
  generateText,
  streamText,
  type ModelMessage
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { detectAndTranslateToEnglish } from "@/lib/ai/language";
import { getChatModel } from "@/lib/ai/openai";
import { getRequestIp, recordMessage, upsertSession } from "@/lib/analytics";
import {
  buildContextBlock,
  buildRagUserPrompt,
  buildSystemPrompt,
  normalizeDomain,
  retrieveRelevantChunks,
  sanitizeTenantId,
  toSourceCitations
} from "@/lib/rag";
import { rateLimit } from "@/lib/security/rate-limit";
import { checkGuardrails, sanitizeOutput } from "@/lib/security/guardrails";
import { rerankChunks, diversityRerank } from "@/lib/rerank";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  messages: z.array(z.any()).min(1),
  sessionId: z.string().uuid().optional(),
  domain: z.string().max(253).optional().nullable(),
  tenantId: z.string().max(160).optional().nullable(),
  stream: z.boolean().optional(),
  voiceMode: z.boolean().optional() // Flag for faster voice responses
});

function textFromMessage(message: ChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function recentMessagesWithPrompt(
  messages: ChatMessage[],
  prompt: string
): ModelMessage[] {
  const latestUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  const recent = messages.slice(Math.max(0, messages.length - 10));
  const prepared = recent.map((message, index) => {
    const absoluteIndex = messages.length - recent.length + index;
    if (absoluteIndex === latestUserIndex) {
      return {
        ...message,
        parts: [{ type: "text" as const, text: prompt }]
      };
    }
    return message;
  });

  return convertToModelMessages(prepared);
}

function wantsLead(text: string, messageCount: number, threshold: number) {
  return (
    messageCount >= threshold ||
    /\b(price|pricing|demo|sales|contact|quote|call|buy|purchase|trial)\b/i.test(
      text
    )
  );
}

function wantsMeeting(text: string): boolean {
  return /\b(book|schedule|set up|arrange|plan)\s+(a\s+)?(meeting|call|demo|consultation|appointment|session)|talk\s+to\s+(an?\s+)?(expert|specialist|team|someone)|meet\s+with|speak\s+with|consultation|appointment/i.test(text);
}

function isCasualGreeting(text: string): boolean {
  const greetingPatterns = [
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|hiya|yo)(!|\?|\.)?$/i,
    /^(hi|hello|hey)\s+(there|everyone|folks)(!|\?|\.)?$/i,
    /^how\s+(are|r)\s+you(\?)?$/i,
    /^what'?s\s+up(\?)?$/i,
    /^sup(\?)?$/i,
    /^thanks?(!|\.)?$/i,
    /^thank\s+you(!|\.)?$/i,
    /^(ok|okay|alright|cool|great)(!|\.)?$/i,
    /^bye(!|\.)?$/i,
    /^goodbye(!|\.)?$/i,
    /^(nice|good)\s+to\s+(meet|see)\s+you(!|\.)?$/i
  ];
  
  const trimmed = text.trim();
  return greetingPatterns.some(pattern => pattern.test(trimmed));
}

async function loadSettings(tenantId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("settings")
    .select("tenant_id, system_prompt, lead_capture_after_messages, allowed_domains")
    .in("tenant_id", [tenantId, "default"]);

  const tenantSettings = data?.find((row) => row.tenant_id === tenantId);
  const defaultSettings = data?.find((row) => row.tenant_id === "default");

  return {
    systemPrompt:
      tenantSettings?.system_prompt ??
      defaultSettings?.system_prompt ??
      "You are a concise, accurate support assistant. Answer only from the supplied context.",
    leadCaptureAfterMessages:
      tenantSettings?.lead_capture_after_messages ??
      defaultSettings?.lead_capture_after_messages ??
      Number(process.env.LEAD_CAPTURE_AFTER_MESSAGES ?? 3),
    allowedDomains:
      tenantSettings?.allowed_domains ?? defaultSettings?.allowed_domains ?? []
  };
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, "chat");
  if (limited) {
    return limited;
  }

  const startedAt = Date.now();
  const json = await request.json();
  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid chat request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const messages = parsed.data.messages as ChatMessage[];
  const latestUser = [...messages].reverse().find((message) => message.role === "user");
  const latestText = latestUser ? textFromMessage(latestUser) : "";

  if (!latestText) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (latestText.length > 8000) {
    return NextResponse.json(
      { error: "Message is too long" },
      { status: 413 }
    );
  }

  const domain = normalizeDomain(parsed.data.domain);
  // Always use 'default' tenant for now (single-tenant mode)
  const effectiveTenant = parsed.data.tenantId ?? null;
  const tenantId = sanitizeTenantId(effectiveTenant);
  const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
  const voiceMode = parsed.data.voiceMode ?? false; // Use faster model for voice
  const settings = await loadSettings(tenantId);

  // Guardrails: Check input for safety
  const enableGuardrails = process.env.GUARDRAILS_ENABLE !== 'false';
  if (enableGuardrails) {
    const guardrailResult = await checkGuardrails(latestText, {
      useAI: process.env.GUARDRAILS_USE_AI === 'true',
      context: settings.systemPrompt
    });

    if (!guardrailResult.safe && process.env.GUARDRAILS_BLOCK_HIGH_SEVERITY !== 'false') {
      const highSeverity = guardrailResult.violations.find(v => v.severity === "high");
      return NextResponse.json(
        { 
          error: highSeverity?.message ?? "Your message was flagged by our safety system.",
          blocked: true 
        },
        { status: 400 }
      );
    }
  }
  if (
    settings.allowedDomains.length > 0 &&
    (!domain || !settings.allowedDomains.includes(domain))
  ) {
    return NextResponse.json(
      { error: "This domain is not allowed for the requested chatbot tenant." },
      { status: 403 }
    );
  }
  const language = await detectAndTranslateToEnglish(latestText);
  
  // Skip RAG retrieval for casual greetings
  const skipRetrieval = isCasualGreeting(latestText);
  
  // Configuration
  // In voice mode, use faster/smaller retrieval for quicker responses
  const initialRetrievalCount = voiceMode ? 10 : Number(process.env.RAG_INITIAL_RETRIEVAL ?? 15);
  const rerankTopK = voiceMode ? 8 : Number(process.env.RAG_RERANK_TOP_K ?? 10);
  const finalTopK = voiceMode ? 5 : Number(process.env.RAG_FINAL_TOP_K ?? 5);
  const enableReranking = process.env.RAG_ENABLE_RERANKING !== 'false';
  const enableDiversity = process.env.RAG_ENABLE_DIVERSITY !== 'false';
  
  // Retrieve more chunks than needed for re-ranking (skip for greetings)
  const initialChunks = skipRetrieval ? [] : await retrieveRelevantChunks({
    query: language.englishText,
    tenantId,
    topK: initialRetrievalCount // Retrieve more for re-ranking
  });
  
  let chunks = initialChunks;
  
  // Re-rank chunks for better relevance
  if (enableReranking && initialChunks.length > finalTopK) {
    chunks = await rerankChunks(
      language.englishText,
      initialChunks,
      rerankTopK // Keep top 10 after re-ranking
    );
  }
  
  // Apply diversity to avoid redundant chunks
  if (enableDiversity && chunks.length > finalTopK) {
    chunks = diversityRerank(chunks, finalTopK);
  } else {
    chunks = chunks.slice(0, finalTopK);
  }
  
  // Debug logging
  console.log("[RAG Debug]", {
    query: language.englishText,
    tenantId,
    skipRetrieval,
    config: {
      reranking: enableReranking,
      diversity: enableDiversity,
      initialRetrieval: initialRetrievalCount,
      finalTopK
    },
    initialChunks: initialChunks.length,
    final: chunks.length,
    scores: chunks.map(c => ({
      similarity: c.similarity.toFixed(3),
      rerank: c.rerankScore?.toFixed(3) ?? 'N/A'
    })),
    titles: chunks.map(c => c.title)
  });
  
  const noContext = chunks.length === 0;
  // Only create sources if we have context (relevant chunks found)
  const sources = noContext ? [] : toSourceCitations(chunks);
  const context = buildContextBlock(chunks);
  const system = buildSystemPrompt({
    systemInstructions: settings.systemPrompt,
    languageName: language.languageName,
    hasContext: !noContext
  });
  const userPrompt = buildRagUserPrompt({
    originalQuestion: latestText,
    englishQuestion: language.englishText,
    context
  });
  const modelMessages = recentMessagesWithPrompt(messages, userPrompt);
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const needsLead = wantsLead(
    latestText,
    userMessageCount,
    settings.leadCaptureAfterMessages
  );
  const needsMeeting = wantsMeeting(latestText);

  await upsertSession({
    sessionId,
    tenantId,
    domain,
    language: language.language,
    request
  });

  await recordMessage({
    sessionId,
    tenantId,
    role: "user",
    content: latestText,
    language: language.language,
    metadata: {
      translated_query: language.englishText,
      domain,
      ip: getRequestIp(request) ? "hashed_in_sessions" : null
    }
  });

  if (parsed.data.stream === false) {
    const result = await generateText({
      model: getChatModel(voiceMode), // Use gpt-5.4-mini only for voice, gpt-5.5 for text
      system,
      messages: modelMessages,
      maxOutputTokens: voiceMode ? 700 : 900 // Slightly shorter for voice
    });

    // Sanitize output to remove potential PII
    const sanitizedText = sanitizeOutput(result.text);

    const responseTimeMs = Date.now() - startedAt;
    await recordMessage({
      sessionId,
      tenantId,
      role: "assistant",
      content: sanitizedText,
      language: language.language,
      sources,
      responseTimeMs,
      metadata: { noContext, needsLead, needsMeeting }
    });

    return NextResponse.json({
      answer: sanitizedText,
      // Only send sources if we had context and used it
      sources: noContext ? [] : sources,
      detectedLanguage: language.language,
      languageName: language.languageName,
      responseTimeMs,
      needsLead,
      needsMeeting
    });
  }

  const result = streamText({
    model: getChatModel(voiceMode), // Use gpt-5.4-mini only for voice, gpt-5.5 for text
    system,
    messages: modelMessages,
    maxOutputTokens: voiceMode ? 700 : 900, // Slightly shorter for voice
    onFinish: async ({ text, usage }) => {
      // Sanitize output before storing
      const sanitizedText = sanitizeOutput(text);
      
      await recordMessage({
        sessionId,
        tenantId,
        role: "assistant",
        content: sanitizedText,
        language: language.language,
        sources,
        responseTimeMs: Date.now() - startedAt,
        metadata: {
          noContext,
          needsLead,
          needsMeeting,
          usage
        }
      });
    }
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    originalMessages: messages,
    messageMetadata: () => ({
      // Only send sources if we had context and used it
      sources: noContext ? [] : sources,
      detectedLanguage: language.language,
      languageName: language.languageName,
      responseTimeMs: Date.now() - startedAt,
      needsLead,
      needsMeeting,
      noContext
    }),
    sendSources: false
  });
}
