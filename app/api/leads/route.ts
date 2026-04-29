import { NextResponse } from "next/server";
import { z } from "zod";
import { hubspotLeadSchema, syncLeadToHubSpot } from "@/lib/hubspot";
import { sanitizeTenantId } from "@/lib/rag";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase";

const leadRequestSchema = hubspotLeadSchema.extend({
  sessionId: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const limited = await rateLimit(request, "leads", 10, 60);
  if (limited) {
    return limited;
  }

  const parsed = leadRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const lead = {
    ...parsed.data,
    tenantId: sanitizeTenantId(parsed.data.tenantId)
  };
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: lead.tenantId,
      session_id: lead.sessionId ?? null,
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? null,
      status: "new",
      metadata: {}
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const hubspot = await syncLeadToHubSpot(lead);
    await supabase
      .from("leads")
      .update({
        status: "synced",
        hubspot_contact_id: hubspot.id,
        hubspot_synced_at: new Date().toISOString()
      })
      .eq("id", data.id);

    return NextResponse.json({ ok: true, id: data.id, hubspotId: hubspot.id });
  } catch (hubspotError) {
    await supabase
      .from("leads")
      .update({
        status: "hubspot_failed",
        metadata: {
          hubspot_error:
            hubspotError instanceof Error
              ? hubspotError.message
              : "HubSpot sync failed"
        }
      })
      .eq("id", data.id);

    return NextResponse.json({ ok: true, id: data.id, hubspotSynced: false });
  }
}
