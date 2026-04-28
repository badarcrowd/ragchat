import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { openaiApiKey } from "@/lib/env";

const openaiClient = new OpenAI({
  apiKey: openaiApiKey()
});

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const mp3 = await openaiClient.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      speed: 1.0
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString()
      }
    });
  } catch (error) {
    console.error("[Voice Speech Error]", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
