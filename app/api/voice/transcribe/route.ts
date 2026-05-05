import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { openaiApiKey, transcriptionModelName } from "@/lib/env";
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

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function filenameForMime(mimeType: string) {
  if (mimeType.includes("mp4")) return "voice.mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "voice.mp3";
  if (mimeType.includes("ogg")) return "voice.ogg";
  if (mimeType.includes("wav")) return "voice.wav";
  return "voice.webm";
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "voice-transcribe", 40, 60);
  if (limited) return limited;

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio file is too large" },
        { status: 413 }
      );
    }

    const mimeType = audio.type || "audio/webm";
    const file = new File([audio], filenameForMime(mimeType), { type: mimeType });

    const transcription = await openaiClient.audio.transcriptions.create({
      file,
      model: transcriptionModelName(),
      language: "en",
      prompt:
        "Crowd Digital website visitor conversation. Common terms: Crowd, SEO, PPC, CRO, RFP, HubSpot, WordPress, UAE, Europe, China, budget, website audit.",
      response_format: "json",
      temperature: 0
    });

    return NextResponse.json(
      { text: transcription.text.trim() },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("[Voice Transcription Error]", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
