import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase";
import type { SourceCitation } from "@/lib/types";

function hashIp(ip: string | null) {
  if (!ip) {
    return null;
  }
  return createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "agent-rag"}:${ip}`)
    .digest("hex");
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
}

export async function upsertSession(input: {
  sessionId: string;
  tenantId: string;
  domain: string | null;
  language?: string;
  request?: Request;
}) {
  const supabase = createSupabaseAdmin();
  const ipHash = input.request ? hashIp(getRequestIp(input.request)) : null;
  const userAgent = input.request?.headers.get("user-agent") ?? null;

  await supabase.from("sessions").upsert(
    {
      id: input.sessionId,
      tenant_id: input.tenantId,
      domain: input.domain,
      language: input.language ?? null,
      user_agent: userAgent,
      ip_hash: ipHash,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
}

export async function recordMessage(input: {
  sessionId: string;
  tenantId: string;
  role: "user" | "assistant";
  content: string;
  language?: string;
  sources?: SourceCitation[];
  responseTimeMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdmin();
  await supabase.from("messages").insert({
    session_id: input.sessionId,
    tenant_id: input.tenantId,
    role: input.role,
    content: input.content,
    language: input.language ?? null,
    sources: input.sources ?? [],
    response_time_ms: input.responseTimeMs ?? null,
    metadata: input.metadata ?? {}
  });
}
