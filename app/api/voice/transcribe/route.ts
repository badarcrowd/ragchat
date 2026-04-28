import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { openaiApiKey } from "@/lib/env";

const openaiClient = new OpenAI({
  apiKey: openaiApiKey()
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob;

    if (!audio) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Convert Blob to File for OpenAI API
    const file = new File([audio], "audio.webm", { type: audio.type });

    const transcription = await openaiClient.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en"
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("[Voice Transcription Error]", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
