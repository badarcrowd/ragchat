"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  ExternalLink,
  Loader2,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Send,
  UserRound,
  Volume2,
  X
} from "lucide-react";
import type { ChatMessage, SourceCitation } from "@/lib/types";

type ChatWidgetProps = {
  embed?: boolean;
  initialDomain?: string;
  initialTenantId?: string;
  brandColor?: string;
  position?: "left" | "right";
};

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readMessageText(message: ChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function SourceLinks({ sources, brandColor }: { sources: SourceCitation[]; brandColor: string }) {
  // Filter out sources without valid URLs
  const validSources = sources.filter(
    (source) => source.url && source.url !== "#" && source.url.trim() !== ""
  );

  if (validSources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3">
      <p className="text-xs font-medium text-neutral-500">Sources:</p>
      <div className="flex flex-wrap gap-2">
        {validSources.map((source, index) => (
          <a
            key={`${source.id}-${index}`}
            href={source.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:text-white"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = brandColor}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            title={source.title ?? source.url ?? "Source"}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{source.title ?? source.url}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function ChatWidget({
  embed = false,
  initialDomain,
  initialTenantId,
  brandColor,
  position = "right"
}: ChatWidgetProps) {
  const [open, setOpen] = useState(!embed);
  const [chatMode, setChatMode] = useState<"text" | "voice">("text");
  const [input, setInput] = useState("");
  const [showLead, setShowLead] = useState(false);
  const [leadState, setLeadState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingState, setMeetingState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [sessionId] = useState(createSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  // Voice state (for voice mode)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [voiceActive, setVoiceActive] = useState(false); // Track if voice conversation is active
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProcessedMessageId = useRef<string | null>(null); // Prevent duplicate processing

  // Text mode voice state (for optional voice features in text mode)
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const chatModeRef = useRef<"text" | "voice">("text");

  // Update ref when chatMode changes
  useEffect(() => {
    chatModeRef.current = chatMode;
  }, [chatMode]);

  const domain =
    initialDomain ??
    (typeof window !== "undefined" ? window.location.hostname : "localhost");
  // Always use 'default' tenant for now (single-tenant mode)
  const tenantId = initialTenantId ?? "default";

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        body: () => ({
          sessionId,
          domain,
          tenantId,
          voiceMode: chatModeRef.current === "voice" // Only use faster model for voice
        })
      }),
    [domain, sessionId, tenantId]
  );

  const { messages, sendMessage, status, stop, error } = useChat<ChatMessage>({
    id: sessionId,
    transport,
    onFinish: ({ message }) => {
      if (message.metadata?.needsMeeting) {
        setShowMeeting(true);
      } else if (message.metadata?.needsLead) {
        setShowLead(true);
      }
    }
  });

  const isBusy = status === "submitted" || status === "streaming";
  const buttonColor = brandColor && /^#[0-9a-f]{6}$/i.test(brandColor)
    ? brandColor
    : "#2f6b4f";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      lastMessageCountRef.current = messages.length;
    }
  }, [messages]);

  useEffect(() => {
    if (!embed || typeof window === "undefined") {
      return;
    }
    window.parent.postMessage(
      {
        type: "rag-widget:size",
        open
      },
      "*"
    );
  }, [embed, open]);

  useEffect(() => {
    const userMessages = messages.filter((message) => message.role === "user");
    const latestUser = userMessages[userMessages.length - 1];
    const latestText = latestUser ? readMessageText(latestUser) : "";
    if (
      userMessages.length >= Number(process.env.NEXT_PUBLIC_LEAD_AFTER_MESSAGES ?? 3) ||
      /\b(price|pricing|demo|sales|contact|quote|call|buy|purchase)\b/i.test(
        latestText
      )
    ) {
      setShowLead(true);
    }
  }, [messages]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) {
      return;
    }
    setInput("");
    await sendMessage({ text });
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLeadState("saving");

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        tenantId,
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone")
      })
    });

    if (response.ok) {
      setLeadState("saved");
      setTimeout(() => setShowLead(false), 1200);
      return;
    }

    setLeadState("error");
  }

  async function submitMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMeetingState("saving");

    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        tenantId,
        name: form.get("name"),
        email: form.get("email"),
        date: form.get("date"),
        time: form.get("time"),
        notes: form.get("notes")
      })
    });

    if (response.ok) {
      setMeetingState("saved");
      setTimeout(() => setShowMeeting(false), 1500);
      return;
    }

    setMeetingState("error");
  }

  // Voice recording functions
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("[Voice Recording Error]", error);
      alert("Microphone access denied. Please enable microphone permissions.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(audioBlob: Blob) {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob);

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = await response.json();
      setInput(data.text);
      setIsTranscribing(false);
    } catch (error) {
      console.error("[Voice Transcription Error]", error);
      setIsTranscribing(false);
    }
  }

  async function speakText(text: string) {
    if (!voiceEnabled) return;
    
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error("Text-to-speech failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch (error) {
      console.error("[Voice Speech Error]", error);
    }
  }

  // Voice Mode Functions (for dedicated voice chat)
  function stopVoiceConversation() {
    // Stop any ongoing recording
    if (mediaRecorderRef.current && voiceStatus === "listening") {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error("[Stop Recording Error]", error);
      }
    }
    
    // Stop any ongoing speech
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    
    // Reset all voice states
    setVoiceActive(false);
    setVoiceStatus("idle");
    setIsSpeaking(false);
    setIsRecording(false);
    mediaRecorderRef.current = null;
  }

  function interruptAI() {
    // Stop AI speaking
    if (audioRef.current && isSpeaking) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setIsSpeaking(false);
    }
    
    // Immediately start listening again
    if (chatMode === "voice") {
      startVoiceRecording();
    }
  }

  async function startVoiceRecording() {
    // Only start if we're in voice chat mode
    if (chatMode !== "voice") return;
    
    try {
      setVoiceStatus("listening");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        
        // Only transcribe if there's actual audio
        if (audioBlob.size > 1000) { // At least 1KB of audio
          await transcribeAndSendVoice(audioBlob);
        } else {
          // No audio detected, resume listening
          if (chatMode === "voice") {
            setTimeout(() => {
              startVoiceRecording();
            }, 500);
          } else {
            setVoiceStatus("idle");
          }
        }
      };

      mediaRecorder.start();
      
      // Auto-stop after 30 seconds maximum
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          stopVoiceRecording();
        }
      }, 30000);
      
    } catch (error) {
      console.error("[Voice Recording Error]", error);
      setVoiceStatus("idle");
      setVoiceActive(false); // Reset active state on any error
      if (error instanceof Error && error.name === "NotAllowedError") {
        alert("Microphone access denied. Please enable microphone permissions to use voice chat.");
      } else {
        alert("Could not start recording. Please check your microphone and try again.");
      }
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorderRef.current && (voiceStatus === "listening" || mediaRecorderRef.current.state === "recording")) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("[Stop Voice Recording Error]", error);
        setVoiceStatus("idle");
      }
    }
  }

  async function transcribeAndSendVoice(audioBlob: Blob) {
    setVoiceStatus("processing");
    try {
      // Transcribe audio
      const formData = new FormData();
      formData.append("audio", audioBlob);

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = await response.json();
      const text = data.text;

      // Automatically send the message
      await sendMessage({ text });

      // Status will change to "speaking" when response arrives
    } catch (error) {
      console.error("[Voice Transcription Error]", error);
      setVoiceStatus("idle");
    }
  }

  async function speakResponse(text: string) {
    setVoiceStatus("speaking");
    setIsSpeaking(true);
    
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error("Text-to-speech failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          // Auto-resume listening after AI finishes speaking (if voice mode is still active)
          if (chatMode === "voice") {
            setTimeout(() => {
              startVoiceRecording();
            }, 500); // Small delay before resuming
          } else {
            setVoiceStatus("idle");
          }
        };
        await audioRef.current.play();
      }
    } catch (error) {
      console.error("[Voice Speech Error]", error);
      setVoiceStatus("idle");
      setIsSpeaking(false);
      // Resume listening even on error
      if (chatMode === "voice") {
        setTimeout(() => {
          startVoiceRecording();
        }, 500);
      }
    }
  }

  // Auto-speak responses in voice mode
  useEffect(() => {
    if (chatMode !== "voice" || isBusy || isSpeaking || !voiceActive) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      // Prevent processing the same message twice
      if (lastProcessedMessageId.current === lastMessage.id) {
        return;
      }
      
      const text = readMessageText(lastMessage);
      if (text) {
        lastProcessedMessageId.current = lastMessage.id;
        speakResponse(text);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, chatMode, isBusy, isSpeaking, voiceActive]);

  // Auto-play bot responses when voice is enabled (text mode)
  useEffect(() => {
    if (!voiceEnabled || isBusy || chatMode !== "text") return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      const text = readMessageText(lastMessage);
      if (text) {
        speakText(text);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, voiceEnabled, isBusy, chatMode]);

  // Auto-start/stop voice mode when switching tabs
  useEffect(() => {
    if (chatMode === "voice") {
      // Reset state when entering voice mode, but don't auto-start
      setVoiceStatus("idle");
      setVoiceActive(false);
      lastProcessedMessageId.current = null; // Reset message tracking
    } else {
      // Cleanup when leaving voice mode
      stopVoiceConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shellClass = embed
    ? `fixed bottom-0 ${position === "left" ? "left-0" : "right-0"} z-[9999] flex items-end bg-transparent p-4`
    : "mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center";

  return (
    <div className={shellClass}>
      <style>{`
        .prose a {
          color: ${buttonColor} !important;
        }
      `}</style>
      {open ? (
        <section
          className={
            embed
              ? "flex h-[min(700px,calc(100vh-32px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl transition-all duration-300 ease-out animate-in slide-in-from-bottom-8"
              : "flex h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
          }
        >
          <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 text-white" style={{ backgroundImage: `linear-gradient(to right, ${buttonColor}, ${buttonColor}f0)` }}>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-sm"
              >
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-semibold">
                  AI Assistant
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                  <p className="truncate text-xs text-white/90">
                    Online • Typically replies instantly
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isBusy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/20"
                  aria-label="Stop response"
                  title="Stop response"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
              {embed ? (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/20"
                  aria-label="Close chat"
                  title="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </header>

          {/* Tab Switcher */}
          <div className="flex border-b border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => setChatMode("text")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                chatMode === "text"
                  ? "border-b-2 text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
              style={chatMode === "text" ? { borderBottomColor: buttonColor, color: buttonColor } : {}}
            >
              <MessageSquare className="h-4 w-4" />
              Text Chat
            </button>
            <button
              type="button"
              onClick={() => setChatMode("voice")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                chatMode === "voice"
                  ? "border-b-2 text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
              style={chatMode === "voice" ? { borderBottomColor: buttonColor, color: buttonColor } : {}}
            >
              <Phone className="h-4 w-4" />
              Voice Chat
            </button>
          </div>

          {/* Text Chat Mode */}
          {chatMode === "text" ? (
          <>
          <div className="scrollbar-thin flex-1 overflow-y-auto bg-gradient-to-b from-neutral-50 to-white p-5">
            {messages.length === 0 ? (
              <div className="mx-auto mt-20 max-w-sm text-center">
                <div
                  className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg"
                  style={{ backgroundColor: buttonColor }}
                >
                  <MessageCircle className="h-8 w-8" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-neutral-800">
                  Hi there! 👋
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  Ask me anything about this site. I&apos;ll provide accurate answers with sources.
                </p>
              </div>
            ) : null}

            <div className="space-y-4">
              {messages.map((message) => {
                const text = readMessageText(message);
                const isUser = message.role === "user";
                return (
                  <article
                    key={message.id}
                    className={`flex gap-3 ${isUser ? "justify-end" : ""}`}
                  >
                    {!isUser ? (
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-sm" style={{ backgroundColor: buttonColor }}>
                        <Bot className="h-4 w-4" />
                      </span>
                    ) : null}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "text-white"
                          : "border border-neutral-200 bg-white text-neutral-800"
                      }`}
                      style={isUser ? { backgroundImage: `linear-gradient(to bottom right, ${buttonColor}, ${buttonColor}f0)` } : {}}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{text}</p>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-neutral-800 prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-neutral-900 prose-pre:text-neutral-100">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {text}
                          </ReactMarkdown>
                        </div>
                      )}
                      {!isUser ? (
                        <SourceLinks sources={message.metadata?.sources ?? []} brandColor={buttonColor} />
                      ) : null}
                    </div>
                    {isUser ? (
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral to-coral/80 text-white shadow-sm">
                        <UserRound className="h-4 w-4" />
                      </span>
                    ) : null}
                  </article>
                );
              })}
              {isBusy ? (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-sm" style={{ backgroundColor: buttonColor }}>
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-2xl bg-neutral-100 px-4 py-3">
                        <span className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400">Writing...</span>
                  </div>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {showMeeting ? (
            <form
              onSubmit={submitMeeting}
              className="border-t border-neutral-200 bg-white p-4"
            >
              <h3 className="mb-3 text-sm font-semibold text-neutral-800">
                📅 Book a Meeting
              </h3>
              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    name="name"
                    required
                    placeholder="Your Name *"
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                    onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = ''}
                  />
                  <input
                    name="email"
                    required
                    type="email"
                    placeholder="Email Address *"
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                    onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = ''}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    name="date"
                    required
                    type="date"
                    placeholder="Preferred Date"
                    min={new Date().toISOString().split('T')[0]}
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                    onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = ''}
                  />
                  <input
                    name="time"
                    required
                    type="time"
                    placeholder="Preferred Time"
                    className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                    onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = ''}
                  />
                </div>
                <textarea
                  name="notes"
                  placeholder="Any specific topics you'd like to discuss? (optional)"
                  rows={2}
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow resize-none"
                  onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                  onBlur={(e) => e.currentTarget.style.borderColor = ''}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  We&apos;ll send a confirmation email shortly.
                </p>
                <button
                  type="submit"
                  disabled={meetingState === "saving" || meetingState === "saved"}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-60"
                  style={{ backgroundColor: buttonColor }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '1')}
                >
                  {meetingState === "saving"
                    ? "Booking..."
                    : meetingState === "saved"
                      ? "Booked! ✓"
                      : "Book Meeting"}
                </button>
              </div>
              {meetingState === "error" ? (
                <p className="mt-2 text-xs text-red-600">
                  Could not book meeting. Please try again.
                </p>
              ) : null}
            </form>
          ) : null}

          {showLead ? (
            <form
              onSubmit={submitLead}
              className="border-t border-neutral-200 bg-white p-4"
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  name="name"
                  required
                  placeholder="Name"
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                  onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                  onBlur={(e) => e.currentTarget.style.borderColor = ''}
                />
                <input
                  name="email"
                  required
                  type="email"
                  placeholder="Email"
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                  onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                  onBlur={(e) => e.currentTarget.style.borderColor = ''}
                />
                <input
                  name="phone"
                  placeholder="Phone"
                  className="rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none transition-shadow"
                  onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
                  onBlur={(e) => e.currentTarget.style.borderColor = ''}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  Share details for a human follow-up.
                </p>
                <button
                  type="submit"
                  disabled={leadState === "saving" || leadState === "saved"}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-60"
                  style={{ backgroundColor: buttonColor }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '1')}
                >
                  {leadState === "saving"
                    ? "Saving"
                    : leadState === "saved"
                      ? "Saved"
                      : "Submit"}
                </button>
              </div>
              {leadState === "error" ? (
                <p className="mt-2 text-xs text-red-600">
                  Could not save lead. Please try again.
                </p>
              ) : null}
            </form>
          ) : null}

          <form
            onSubmit={submitMessage}
            className="flex items-end gap-3 border-t border-neutral-200 bg-white p-4"
          >
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-all ${
                voiceEnabled
                  ? "text-white shadow-md hover:shadow-lg"
                  : "border-2 text-neutral-400 hover:text-neutral-600"
              }`}
              style={voiceEnabled ? { backgroundColor: buttonColor, borderColor: buttonColor } : { borderColor: "#d4d4d8" }}
              aria-label={voiceEnabled ? "Disable voice" : "Enable voice"}
              title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={isTranscribing ? "Transcribing..." : "Type or speak your message..."}
              rows={1}
              disabled={isTranscribing || isRecording}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition-shadow disabled:bg-neutral-50"
              onFocus={(e) => e.currentTarget.style.borderColor = buttonColor}
              onBlur={(e) => e.currentTarget.style.borderColor = ''}
            />
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-all ${
                isRecording
                  ? "animate-pulse bg-red-500 text-white shadow-lg"
                  : "border-2 text-neutral-600 hover:text-white hover:shadow-md disabled:opacity-50"
              }`}
              style={!isRecording ? { borderColor: buttonColor } : {}}
              onMouseEnter={(e) => !isRecording && !isTranscribing && (e.currentTarget.style.backgroundColor = buttonColor)}
              onMouseLeave={(e) => !isRecording && (e.currentTarget.style.backgroundColor = '')}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              title={isRecording ? "Stop recording" : "Start voice message"}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isBusy}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:shadow-sm"
              style={{ backgroundColor: buttonColor }}
              aria-label="Send message"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          {error ? (
            <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error.message}
            </p>
          ) : null}
          </>
          ) : (
          /* Voice Chat Mode */
          <>
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-neutral-50 to-white p-5">
            {/* Voice Chat Messages */}
            <div className="space-y-4">
              {messages.map((message) => {
                const text = readMessageText(message);
                const isUser = message.role === "user";
                return (
                  <article
                    key={message.id}
                    className={`flex gap-3 ${isUser ? "justify-end" : ""}`}
                  >
                    {!isUser ? (
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-sm" style={{ backgroundColor: buttonColor }}>
                        <Bot className="h-4 w-4" />
                      </span>
                    ) : null}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "text-white"
                          : "border border-neutral-200 bg-white text-neutral-800"
                      }`}
                      style={isUser ? { backgroundImage: `linear-gradient(to bottom right, ${buttonColor}, ${buttonColor}f0)` } : {}}
                    >
                      <p className="whitespace-pre-wrap">{text}</p>
                    </div>
                    {isUser ? (
                      <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral to-coral/80 text-white shadow-sm">
                        <UserRound className="h-4 w-4" />
                      </span>
                    ) : null}
                  </article>
                );
              })}
              {voiceStatus === "processing" || isBusy ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Status Indicator */}
            {messages.length === 0 ? (
              <div className="mx-auto mt-20 max-w-sm text-center">
                <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full" style={{ backgroundColor: `${buttonColor}20` }}>
                  <Phone className="h-10 w-10" style={{ color: buttonColor }} />
                </div>
                <h2 className="text-xl font-semibold text-neutral-800">
                  Voice Chat
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  Click the microphone button below to start a voice conversation. Speak naturally and I&apos;ll respond with voice!
                </p>
              </div>
            ) : null}
          </div>

          {/* Voice Controls */}
          <div className="border-t border-neutral-200 bg-white p-6">
            <div className="flex flex-col items-center gap-4">
              {/* Status Text */}
              <p className="text-sm font-medium text-neutral-600">
                {voiceStatus === "idle" && !voiceActive && "Ready to start"}
                {voiceStatus === "idle" && voiceActive && "Initializing..."}
                {voiceStatus === "listening" && "🎤 Listening to you..."}
                {voiceStatus === "processing" && "⚡ Processing your message..."}
                {voiceStatus === "speaking" && "🔊 AI is speaking..."}
              </p>

              {/* Main Action Button */}
              {voiceStatus === "idle" && !voiceActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setVoiceActive(true);
                    setTimeout(() => startVoiceRecording(), 200);
                  }}
                  className="grid h-24 w-24 place-items-center rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: buttonColor }}
                  aria-label="Start voice chat"
                >
                  <Mic className="h-10 w-10" />
                </button>
              ) : voiceStatus === "listening" ? (
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="grid h-24 w-24 place-items-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:bg-red-600 active:scale-95 animate-pulse"
                  aria-label="Stop listening"
                >
                  <MicOff className="h-10 w-10" />
                </button>
              ) : voiceStatus === "speaking" ? (
                <button
                  type="button"
                  onClick={interruptAI}
                  className="grid h-24 w-24 place-items-center rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: buttonColor }}
                  aria-label="Interrupt and speak"
                >
                  <Mic className="h-10 w-10" />
                </button>
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-full text-white shadow-2xl opacity-60"
                  style={{ backgroundColor: buttonColor }}>
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
              )}

              {/* Instructions */}
              <p className="text-xs text-center text-neutral-500">
                {voiceStatus === "idle" && !voiceActive && "Click the microphone to start voice conversation"}
                {voiceStatus === "idle" && voiceActive && "Getting ready to listen..."}
                {voiceStatus === "listening" && "Click to stop recording and send"}
                {voiceStatus === "processing" && "Processing your message..."}
                {voiceStatus === "speaking" && "Click to interrupt and speak"}
              </p>

              {/* Stop Voice Chat Button */}
              <button
                type="button"
                onClick={() => {
                  stopVoiceConversation();
                  setChatMode("text");
                }}
                className="mt-2 rounded-lg px-4 py-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                ✕ Stop Voice Chat
              </button>
            </div>
          </div>
          </>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group grid h-14 w-14 place-items-center rounded-full text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          style={{ 
            backgroundColor: buttonColor
          }}
          aria-label="Open chat"
          title="Open chat"
        >
          <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />
        </button>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
