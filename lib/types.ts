import type { UIMessage } from "ai";

export type SourceCitation = {
  id: string;
  title: string | null;
  url: string | null;
  similarity?: number;
};

export type ChatMetadata = {
  sources?: SourceCitation[];
  detectedLanguage?: string;
  languageName?: string;
  responseTimeMs?: number;
  needsLead?: boolean;
  needsMeeting?: boolean;
  noContext?: boolean;
};

export type ChatMessage = UIMessage<ChatMetadata>;

export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  source_url: string | null;
  title: string | null;
  similarity: number;
  rerankScore?: number;
  rerankReason?: string;
};

export type DocumentRow = {
  id: string;
  tenant_id: string;
  title: string | null;
  source_url: string | null;
  type: "url" | "pdf" | "text";
  status: "queued" | "indexed" | "failed";
  chunk_count: number;
  created_at: string;
  indexed_at: string | null;
};

export type LeadRow = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  hubspot_contact_id: string | null;
  created_at: string;
};

export type AdminAnalytics = {
  dailyQueries: Array<{ date: string; count: number }>;
  topQuestions: Array<{ question: string; count: number }>;
};

export type AdminDashboardData = {
  stats: {
    documents: number;
    chunks: number;
    leads: number;
    messages: number;
  };
  documents: DocumentRow[];
  leads: LeadRow[];
  settings: {
    systemPrompt: string;
    leadCaptureAfterMessages: number;
    allowedDomains: string[];
    brandColor: string;

  };
  analytics: AdminAnalytics;
};
