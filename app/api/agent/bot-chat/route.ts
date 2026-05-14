import { generateText, tool, stepCountIs } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { getChatModel } from "@/lib/ai/openai";
import { runPageSpeedAudit } from "@/lib/agent/pagespeed";
import { rateLimit } from "@/lib/security/rate-limit";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 60;

// ── FIELD VALIDATORS ──────────────────────────────────────────────────────
function validateField(name: string, value: string): string | null {
  const v = value.trim();
  if (name === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
      ? null
      : "That doesn't look like a valid email address. Could you double-check it?";
  }
  if (name === "phone") {
    const digits = v.replaceAll(/\D/g, "");
    return digits.length >= 7
      ? null
      : "Phone number looks too short. Please include the country code (e.g. +971 50 123 4567).";
  }
  if (name === "website") {
    try {
      new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      return null;
    } catch {
      return "That URL doesn't look right. Try something like https://yoursite.com.";
    }
  }
  return null;
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────
// CRITICAL: only ONE tool call per turn, ALWAYS end with a text reply.
// Do NOT chain tools. Do NOT call score_lead, validate_budget, or any other
// tool — just extract_lead_data and run_website_audit.
const BOT_SYSTEM_PROMPT = `# IDENTITY
You are Aria — the AI concierge for Crowd Digital, a premium growth agency. You sit on the contact page as a floating assistant and help visitors share their details naturally so the Crowd team can follow up. You sound like a senior strategist starting a quick consultation, never like a form, ticket, or survey bot.

# OUTPUT FORMAT (HARD RULES)
- Replies may be spoken aloud by TTS. Plain text only: no markdown, no asterisks, no bullet dashes, no emoji, no headers.
- Maximum 2 short sentences per reply. Tighter is better.
- ONE tool call per reply, then ALWAYS finish with a text response. Never end a turn with only a tool call.
- Never read field names back to the user (no "first_name captured", no "stored as cost"). Speak naturally.

# AVAILABLE TOOLS
- extract_lead_data — call once per turn with every field the user just provided in this message. Pass values exactly as the user wrote them.
- run_website_audit — call ONCE the moment a website URL is captured. Do not ask permission, do not announce it, do not re-run it.
Never invent or call any other tool name.

# DYNAMIC STATE INJECTION
On every turn the system appends two blocks to this prompt:
- CURRENT LEAD STATE — fields already captured. Treat these as authoritative. Never re-ask any field listed there.
- NEXT FIELD TO COLLECT — INTERNAL DEVELOPER GUIDANCE for what to ask next. NEVER read this text aloud, NEVER repeat it verbatim, NEVER prefix your reply with "Ask…" or "Ask for…". It tells you which field(s) to request — you must phrase the actual question warmly in your own words as a direct, conversational question to the visitor.
If NEXT FIELD says "All fields collected", close warmly: "You're all set, [first name]. The Crowd team will be in touch very soon."

EXAMPLES of correct rephrasing:
- Guidance: "Ask only for the best work email to reach them on." → Reply: "Got the website. What's the best email to reach you on?"
- Guidance: "The website is in. Ask warmly for the work email and company name in one short message." → Reply: "Perfect, got the site. Could I grab your work email and company name?"
- Guidance: "Ask casually what industry they're in." → Reply: "By the way, what industry are you in?"
NEVER reply with the guidance text itself. The visitor must never see words like "Ask for…", "ONE warm message", or any developer phrasing.

# CONVERSATIONAL FLOW (REFERENCE)
The NEXT FIELD instruction always wins. The list below is the order it follows so you can anticipate context:
1. Name (opener)
2. Work email + company + website — asked together in ONE warm message so the analysis can begin
3. Silent website audit (the moment a URL is captured)
4. Sector / industry
5. Crowd office (UAE, USA, Europe, China)
6. Business challenge
7. Success criteria
8. Budget
9. Project start date
10. RFP details
11. Phone with country code (right before handoff)

# OPENING
First message of the conversation, when nothing is captured yet:
"Hi, I'm Aria from Crowd Digital. Happy to help — could I start with your name?"
Never bundle other fields into the opener.

# REPLY STRUCTURE
Every reply after the opener follows this shape:
[brief warm acknowledgment of what the user just said] + [the NEXT FIELD question, phrased naturally]
Use the visitor's first name once you have it, sparingly — not in every sentence.
Examples of good acknowledgments: "Lovely to meet you, John." / "Got it." / "Perfect." / "Nice."
Avoid robotic phrases: "Please provide…", "Kindly share…", "I will now ask…", "Your information has been recorded."

# WEBSITE AUDIT BEHAVIOUR
- The moment a URL appears in the user's message, call run_website_audit ONCE in the same turn as extract_lead_data.
- Do not say "I'm running a check" or "give me a moment" — keep the conversation moving.
- When the audit result is available in the next turn, weave ONE genuinely useful finding into your acknowledgment in plain language ("Quick note from your site — your mobile speed score is sitting around 62, definitely room to lift that.") then continue to the next NEXT FIELD.

# VALIDATION GATE (HARD RULE)
extract_lead_data returns either { ok: true } or { ok: false, validationErrors: { … } }.
- If validationErrors is present, you MUST NOT advance. Acknowledge softly and re-ask ONLY the failing field. Other captured-this-turn fields stay stored.
- Map errors to natural phrasing:
  - email → "Hmm, that email doesn't look quite right — mind double-checking it?"
  - phone → "That number looks incomplete — could you resend it with country code?"
  - website → "That URL doesn't look right — try something like https://yoursite.com."
- Never use the words "invalid", "error", "rejected", or "failed". Never expose raw error objects.
- A valid value can never be re-asked. If it's in CURRENT LEAD STATE, it's done.

# WHEN THE USER VOLUNTEERS MULTIPLE FIELDS AT ONCE
- Make ONE extract_lead_data call containing every field you can confidently identify (split full names into first_name + last_name).
- Then jump straight to whatever NEXT FIELD becomes after the merge — skip questions whose answers are already captured.

# WHEN THE USER GOES OFF-SCRIPT
- Small talk or a question about Crowd: answer in one warm sentence, then gently steer back to the NEXT FIELD.
- Asks about pricing or services: give a one-line consultative pointer (starter / growth / enterprise) and continue collecting.
- Refuses or skips a field: acknowledge warmly, ask once more in a softer way, and if they refuse again, continue to the NEXT FIELD without that one rather than blocking the flow. Phone and email are the only fields worth a second polite nudge.

# TONE EXAMPLES
✗ "Please provide your work email."  →  ✓ "What's the best email to reach you on?"
✗ "Your budget has been recorded."  →  ✓ "Got it — when are you hoping to start?"
✗ "I will now ask you a series of questions."  →  ✓ silently begin.
✗ "Thanks! What's next on the form?"  →  ✓ ask the actual NEXT FIELD question.

# NEVER
- Never describe the form, the steps remaining, or your own process.
- Never list options unless the NEXT FIELD instruction explicitly tells you to.
- Never apologise for asking questions — you're a consultant, not a support agent.
- Never end a turn with only a tool call. Always close with the text reply that asks the next question or shares the next insight.`;

// ── REQUEST SCHEMA ─────────────────────────────────────────────────────────
const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })
  ).min(1),
  leadData: z.record(z.string()).optional().default({}),
  sessionId: z.string().optional(),
  tenantId: z.string().optional()
});

const providerOptions: { openai: OpenAIResponsesProviderOptions } = {
  openai: {
    reasoningEffort: "low",
    textVerbosity: "low",
    promptCacheKey: "crowd-wordpress-form-agent",
    promptCacheRetention: "in_memory"
  }
};

// ── HANDLER ────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const limited = await rateLimit(request, "bot-chat", 30, 60);
  if (limited) return limited;

  const json = await request.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, leadData } = parsed.data;
  const cf7Fields: Record<string, string> = {};
  let auditResult: Record<string, unknown> | null = null;

  // Field name mapping: AI name → CF7 field name
  const CF7_MAP: Record<string, string> = {
    first_name: "first_name",
    last_name:  "last_name",
    email:      "email",
    phone:      "phone",
    company:    "company",
    website:    "website",
    sector:     "sector",
    location:   "location",
    business:   "business",
    success:    "success",
    budget:     "cost",
    cost:       "cost",
    start:      "start",
    rfp:        "rfp"
  };

  // Canonical field order — mirrors the system prompt's PROGRESSIVE FIELDS list.
  // The model uses this + leadData to know exactly which question comes next,
  // instead of asking "what's next on the form?".
  // `ask` is GUIDANCE for the model — it should rephrase warmly, never echo verbatim.
  // For multi-key steps, `askForMissing` returns a focused instruction based on
  // which keys are still outstanding, so we never ask for already-captured fields.
  type Step = {
    keys: string[];
    ask: string;
    askForMissing?: (missing: string[]) => string;
  };
  const FIELD_ORDER: Step[] = [
    {
      keys: ["first_name"],
      ask: "Greet warmly and ask for the visitor's first name."
    },
    {
      keys: ["email", "company", "website"],
      ask: "Ask for work email, company name, and website URL together in ONE warm message so the analysis can start.",
      askForMissing: (missing) => {
        const m = new Set(missing);
        if (m.size === 3) return "Ask warmly for work email, company name, and website URL in ONE short message so the analysis can begin.";
        if (m.has("email") && m.has("company")) return "The website is in. Ask warmly for the work email and company name in one short message.";
        if (m.has("email") && m.has("website")) return "The company is noted. Ask warmly for the work email and website URL in one short message.";
        if (m.has("company") && m.has("website")) return "The email is in. Ask warmly for the company name and website URL in one short message.";
        if (m.has("email")) return "Ask only for the best work email to reach them on.";
        if (m.has("company")) return "Ask only which company they're working with.";
        if (m.has("website")) return "Ask only for their website URL so the analysis can begin.";
        return "Continue to the next step.";
      }
    },
    { keys: ["sector"], ask: "Ask casually what industry they're in." },
    { keys: ["location"], ask: "Ask which Crowd office should handle this — Middle East, USA, Europe, or Asia." },
    { keys: ["business"], ask: "Ask about the core business or marketing challenge to solve." },
    { keys: ["success"], ask: "Ask what success looks like for this project." },
    { keys: ["cost"], ask: "Ask about the available budget for this project." },
    { keys: ["start"], ask: "Ask when they're looking to start." },
    { keys: ["rfp"], ask: "Ask whether this is part of an RFP process." },
    { keys: ["phone"], ask: "Ask for the best contact number with country code, framed as the last thing before handoff." }
  ];

  const capturedKeys = new Set(
    Object.entries(leadData)
      .filter(([, v]) => v && String(v).trim())
      .map(([k]) => k)
  );
  const isCaptured = (k: string) => capturedKeys.has(k) || capturedKeys.has(CF7_MAP[k] ?? k);
  const nextStep = FIELD_ORDER.find((step) => !step.keys.every(isCaptured));
  const nextAsk = nextStep
    ? (nextStep.askForMissing
        ? nextStep.askForMissing(nextStep.keys.filter((k) => !isCaptured(k)))
        : nextStep.ask)
    : null;

  const capturedSummary = [...capturedKeys]
    .map((k) => `- ${k}: ${leadData[k]}`)
    .join("\n");
  const stateBlock = `\n\nCURRENT LEAD STATE (do not re-ask any of these):\n${
    capturedSummary || "(nothing captured yet)"
  }\n\nNEXT FIELD TO COLLECT (this is GUIDANCE — rephrase warmly in your own words, never echo this text verbatim): ${
    nextAsk ?? "All fields collected — confirm completion warmly: \"You're all set, [name]. The Crowd team will be in touch very soon.\""
  }`;

  try {
    const result = await generateText({
      model: getChatModel(true),
      system: BOT_SYSTEM_PROMPT + stateBlock,
      messages,
      stopWhen: stepCountIs(2),   // ONE tool call max → then text. Prevents chaining.
      maxRetries: 1,
      providerOptions,
      maxOutputTokens: 180,
      tools: {
        extract_lead_data: tool({
          description:
            "Store one or more field values the user just provided. " +
            "Call this once per turn with whatever fields the user mentioned.",
          inputSchema: z.object({
            first_name: z.string().optional(),
            last_name:  z.string().optional(),
            email:      z.string().optional(),
            phone:      z.string().optional(),
            company:    z.string().optional(),
            website:    z.string().optional(),
            sector:     z.string().optional(),
            location:   z.string().optional(),
            business:   z.string().optional(),
            success:    z.string().optional(),
            budget:     z.string().optional(),
            cost:       z.string().optional(),
            start:      z.string().optional(),
            rfp:        z.string().optional()
          }),
          execute: async (params) => {
            const errors: Record<string, string> = {};
            for (const [k, v] of Object.entries(params)) {
              if (!v || !CF7_MAP[k]) continue;
              const err = validateField(k, String(v));
              if (err) {
                errors[k] = err;
              } else {
                cf7Fields[CF7_MAP[k]] = String(v);
              }
            }
            return Object.keys(errors).length > 0
              ? { ok: false, validationErrors: errors }
              : { ok: true };
          }
        }),

        run_website_audit: tool({
          description:
            "Run a PageSpeed performance audit on the user's website. " +
            "Only call this when the user provides a URL.",
          inputSchema: z.object({
            url: z.string().describe("Full website URL to audit")
          }),
          execute: async ({ url }) => {
            const normalised = /^https?:\/\//i.test(url) ? url : `https://${url}`;
            cf7Fields.website = normalised;
            try {
              const r = await runPageSpeedAudit(normalised);
              auditResult = {
                mobileScore:  r.mobileScore,
                desktopScore: r.desktopScore,
                summary:      r.summary,
                issues:       r.issues.slice(0, 2)
              };
              return auditResult;
            } catch {
              return { error: "Audit unavailable — proceeding." };
            }
          }
        })
      }
    });

    // If the model only called tools and produced no text (shouldn't happen with
    // maxSteps:2, but guard anyway), do a plain follow-up call with no tools.
    let responseText = result.text?.trim();
    if (!responseText) {
      // Recompute next field using the freshly captured cf7Fields so the
      // fallback question is correct even after this turn's tool call.
      const mergedKeys = new Set([...capturedKeys, ...Object.keys(cf7Fields)]);
      const isCapturedNow = (k: string) =>
        mergedKeys.has(k) || mergedKeys.has(CF7_MAP[k] ?? k);
      const nextNow = FIELD_ORDER.find((step) => !step.keys.every(isCapturedNow));
      const freshAsk = nextNow
        ? (nextNow.askForMissing
            ? nextNow.askForMissing(nextNow.keys.filter((k) => !isCapturedNow(k)))
            : nextNow.ask)
        : "All fields collected — confirm completion warmly: \"You're all set, [name]. The Crowd team will be in touch very soon.\"";

      const fallback = await generateText({
        model: getChatModel(true),
        system: `${BOT_SYSTEM_PROMPT}\n\nNEXT FIELD TO COLLECT: ${freshAsk}`,
        messages: [
          ...messages,
          {
            role: "assistant" as const,
            content: `[System: just stored fields: ${Object.keys(cf7Fields).join(", ") || "none"}]`
          }
        ],
        stopWhen: stepCountIs(1),
        providerOptions,
        maxOutputTokens: 120
      });
      responseText = fallback.text?.trim() || (nextNow ? freshAsk : "You're all set. The Crowd team will be in touch very soon.");
    }

    const allLeadData = { ...leadData, ...cf7Fields };

    return NextResponse.json({
      text:      responseText,
      cf7Fields: Object.keys(cf7Fields).length > 0 ? cf7Fields : null,
      audit:     auditResult,
      leadData:  allLeadData
    });

  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[BotChat]", detail);
    return NextResponse.json({ error: "Agent error", detail }, { status: 500 });
  }
}
