import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sanitizeTenantId } from "@/lib/rag";

const bookingSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  slotId: z.string().max(100),
  slotIso: z.string().datetime(),
  displayDate: z.string().max(100),
  displayTime: z.string().max(50),
  notes: z.string().max(1000).optional(),
  sessionId: z.string().uuid().optional(),
  tenantId: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const limited = await rateLimit(request, "book_meeting", 5, 60);
  if (limited) return limited;

  const json = await request.json();
  const parsed = bookingSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid booking request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const tenantId = sanitizeTenantId(data.tenantId ?? null);
  const supabase = createSupabaseAdmin();

  // Upsert lead
  const { data: lead } = await supabase
    .from("leads")
    .upsert(
      {
        tenant_id: tenantId,
        session_id: data.sessionId ?? null,
        name: data.name,
        email: data.email,
        phone: null,
        status: "meeting_booked",
        metadata: {
          meeting_date: data.displayDate,
          meeting_time: data.displayTime,
          meeting_notes: data.notes
        }
      },
      { onConflict: "tenant_id, email" }
    )
    .select("id")
    .maybeSingle();

  // Insert booking record
  const { error: bookingError } = await supabase.from("meeting_bookings").insert({
    tenant_id: tenantId,
    session_id: data.sessionId ?? null,
    lead_id: lead?.id ?? null,
    name: data.name,
    email: data.email,
    slot_iso: data.slotIso,
    display_date: data.displayDate,
    display_time: data.displayTime,
    notes: data.notes ?? null,
    status: "pending"
  });

  if (bookingError) {
    console.error("[Book Meeting]", bookingError);
    return NextResponse.json({ error: "Failed to save booking" }, { status: 500 });
  }

  // Optionally create Google Calendar event
  await tryCreateCalendarEvent(data);

  return NextResponse.json({
    success: true,
    message: `Meeting booked for ${data.displayDate} at ${data.displayTime}.`
  });
}

async function tryCreateCalendarEvent(data: {
  name: string;
  email: string;
  slotIso: string;
  displayDate: string;
  displayTime: string;
  notes?: string;
}) {
  const token = process.env.GOOGLE_CALENDAR_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  if (!token) return;

  const start = new Date(data.slotIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour

  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: `Strategy Call — ${data.name}`,
          description: data.notes ?? "Booked via Crowd Agent",
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: [{ email: data.email, displayName: data.name }],
          reminders: {
            useDefault: false,
            overrides: [{ method: "email", minutes: 60 }]
          }
        }),
        signal: AbortSignal.timeout(8_000)
      }
    );
  } catch {
    // Non-blocking — calendar event creation is best-effort
  }
}
