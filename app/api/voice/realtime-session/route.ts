import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  openaiApiKey,
  realtimeModelName,
  transcriptionModelName,
  ttsVoiceName
} from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const openaiClient = new OpenAI({
  apiKey: openaiApiKey()
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const REALTIME_INSTRUCTIONS = `You are Crowd Agent, a concise voice copilot for Crowd Digital website visitors.
Help visitors through the contact form one field at a time, answer from available website context when provided, qualify the lead naturally, and recommend the next business action.
Speak in 1 or 2 short sentences, ask only one question at a time, and avoid markdown or lists.
If a visitor provides name, email, phone, company, website, sector, challenge, budget, location, timeline, or RFP details, acknowledge the field and continue to the earliest missing field.
If they ask for pricing or budget guidance, map them to starter, growth, or enterprise support and invite a strategy call when intent is strong.`;

function safeVoice(value: unknown) {
  if (typeof value !== "string") return ttsVoiceName();
  return /^[a-z0-9_-]{2,64}$/i.test(value) ? value : ttsVoiceName();
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "voice-realtime-session", 20, 60);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const voice = safeVoice(body?.voice);

    const session = await openaiClient.realtime.clientSecrets.create({
      expires_after: {
        anchor: "created_at",
        seconds: 120
      },
      session: {
        type: "realtime",
        model: realtimeModelName(),
        output_modalities: ["audio"],
        instructions: REALTIME_INSTRUCTIONS,
        max_output_tokens: 220,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: transcriptionModelName(),
              language: "en",
              prompt:
                "Crowd Digital lead conversation: SEO, PPC, CRO, WordPress, website audit, RFP, UAE, Europe, China, budget."
            },
            turn_detection: {
              type: "server_vad",
              create_response: true,
              interrupt_response: true,
              prefix_padding_ms: 250,
              silence_duration_ms: 420,
              threshold: 0.5,
              idle_timeout_ms: 6000
            }
          },
          output: {
            voice,
            speed: 1.04
          }
        }
      }
    });

    return NextResponse.json(
      {
        clientSecret: session.value,
        expiresAt: session.expires_at,
        model: realtimeModelName(),
        session: session.session
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Realtime Session Error]", error);
    return NextResponse.json(
      { error: "Failed to create realtime voice session" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
