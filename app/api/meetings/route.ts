import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeTenantId } from "@/lib/rag";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase";

const meetingRequestSchema = z.object({
  sessionId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  date: z.string(), // ISO date string
  time: z.string(), // e.g., "14:00"
  notes: z.string().optional()
});

export async function POST(request: Request) {
  const limited = await rateLimit(request, "meetings", 5, 60);
  if (limited) {
    return limited;
  }

  const parsed = meetingRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid meeting request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const meeting = {
    ...parsed.data,
    tenantId: sanitizeTenantId(parsed.data.tenantId)
  };
  const supabase = createSupabaseAdmin();

  // Create lead record
  const { data: leadData, error: leadError } = await supabase
    .from("leads")
    .insert({
      tenant_id: meeting.tenantId,
      session_id: meeting.sessionId ?? null,
      name: meeting.name,
      email: meeting.email,
      phone: null,
      status: "meeting_requested",
      metadata: {
        meeting_date: meeting.date,
        meeting_time: meeting.time,
        meeting_notes: meeting.notes,
        requested_at: new Date().toISOString()
      }
    })
    .select("id")
    .single();

  if (leadError) {
    console.error("[Meeting Create Error]", leadError);
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  // Send email confirmation (basic implementation)
  try {
    await sendMeetingConfirmation({
      name: meeting.name,
      email: meeting.email,
      date: meeting.date,
      time: meeting.time,
      notes: meeting.notes
    });
  } catch (emailError) {
    console.error("[Meeting Email Error]", emailError);
    // Don't fail the request if email fails
  }

  return NextResponse.json({
    success: true,
    leadId: leadData.id,
    message: "Meeting request submitted successfully! Check your email for confirmation."
  });
}

async function sendMeetingConfirmation(params: {
  name: string;
  email: string;
  date: string;
  time: string;
  notes?: string;
}) {
  // TODO: Integrate with your email service (SendGrid, Resend, etc.)
  // For now, just log it
  console.log("[Meeting Confirmation]", {
    to: params.email,
    subject: "Meeting Request Confirmed",
    body: `Hi ${params.name},\n\nYour meeting request has been received:\n\nDate: ${params.date}\nTime: ${params.time}\n${params.notes ? `Notes: ${params.notes}\n` : ''}\n\nWe'll get back to you shortly to confirm.\n\nBest regards,\nThe Team`
  });

  // Example: Send via console for now
  // In production, use Resend, SendGrid, or similar:
  // await resend.emails.send({
  //   from: 'noreply@yourdomain.com',
  //   to: params.email,
  //   subject: 'Meeting Request Confirmed',
  //   html: `<p>Hi ${params.name}...</p>`
  // });
}
