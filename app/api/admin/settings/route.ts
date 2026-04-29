import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeTenantId } from "@/lib/rag";
import { createSupabaseAdmin } from "@/lib/supabase";

const schema = z.object({
  tenantId: z.string().min(1).max(160).default("default"),
  systemPrompt: z.string().min(20).max(6000),
  leadCaptureAfterMessages: z.number().int().min(1).max(20),
  allowedDomains: z.array(z.string().min(1).max(253)).default([]),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  voiceEnabled: z.boolean().optional(),
  widgetPosition: z.enum(["left", "right"]).optional(),
  widgetTitle: z.string().min(1).max(100).optional(),
  widgetWelcomeMessage: z.string().max(500).optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const metadata: Record<string, unknown> = {};
  if (parsed.data.brandColor) metadata.brand_color = parsed.data.brandColor;
  if (parsed.data.voiceEnabled !== undefined) metadata.voice_enabled = parsed.data.voiceEnabled;
  if (parsed.data.widgetPosition) metadata.widget_position = parsed.data.widgetPosition;
  if (parsed.data.widgetTitle) metadata.widget_title = parsed.data.widgetTitle;
  if (parsed.data.widgetWelcomeMessage) metadata.widget_welcome_message = parsed.data.widgetWelcomeMessage;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("settings").upsert(
    {
      tenant_id: sanitizeTenantId(parsed.data.tenantId),
      system_prompt: parsed.data.systemPrompt,
      lead_capture_after_messages: parsed.data.leadCaptureAfterMessages,
      allowed_domains: parsed.data.allowedDomains.map((domain) =>
        domain.toLowerCase()
      ),
      metadata,
      updated_at: new Date().toISOString()
    },
    { onConflict: "tenant_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
