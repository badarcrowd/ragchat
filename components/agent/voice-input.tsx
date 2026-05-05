"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import {
  getVoiceRecorderOptions,
  voiceCaptureConstraints,
} from "@/lib/voice/browser";

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function VoiceInput({ onTranscript, disabled = false }: Props) {
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        voiceCaptureConstraints
      );
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, getVoiceRecorderOptions());

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        await transcribe(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setStatus("recording");
    } catch {
      setStatus("idle");
      alert("Microphone access is required for voice input.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setStatus("processing");
  }

  async function transcribe(blob: Blob) {
    try {
      const form = new FormData();
      form.append("audio", blob, "audio.webm");

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form
      });

      if (!res.ok) throw new Error("Transcription failed");
      const { text } = await res.json();
      if (text?.trim()) onTranscript(text.trim());
    } catch {
      // Silently fail — user can retry
    } finally {
      setStatus("idle");
    }
  }

  function handleClick() {
    if (status === "idle") startRecording();
    else if (status === "recording") stopRecording();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || status === "processing"}
      title={
        status === "idle"
          ? "Click to speak"
          : status === "recording"
          ? "Click to stop"
          : "Processing…"
      }
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-40 ${
        status === "recording"
          ? "border-red-400 bg-red-50 text-red-500 animate-pulse"
          : status === "processing"
          ? "border-neutral-300 bg-neutral-50 text-neutral-400"
          : "border-neutral-300 bg-white text-neutral-500 hover:border-indigo-400 hover:text-indigo-500"
      }`}
    >
      {status === "processing" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === "recording" ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
