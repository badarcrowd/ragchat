import { NextResponse } from "next/server";
import { hubspotLeadSchema, syncLeadToHubSpot } from "@/lib/hubspot";
import { sanitizeTenantId } from "@/lib/rag";
import { rateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimit(request, "hubspot", 20, 60);
  if (limited) {
    return limited;
  }

  const parsed = hubspotLeadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid HubSpot payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await syncLeadToHubSpot({
      ...parsed.data,
      tenantId: sanitizeTenantId(parsed.data.tenantId)
    });
    return NextResponse.json({ ok: true, hubspotId: result.id });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "HubSpot sync failed"
      },
      { status: 502 }
    );
  }
}
