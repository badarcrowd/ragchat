import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeTenantId } from "@/lib/rag";

export async function POST(request: Request) {
  const limited = await rateLimit(request, "admin", 5, 60);
  if (limited) {
    return limited;
  }

  const { tenantId, type, format } = await request.json();
  const tid = sanitizeTenantId(tenantId || "default");
  const supabase = createSupabaseAdmin();

  if (type === "leads") {
    const { data, error } = await supabase
      .from("leads")
      .select("name, email, phone, status, created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }

    if (format === "csv") {
      const csv = [
        ["Name", "Email", "Phone", "Status", "Created At"],
        ...data.map((lead) => [
          lead.name,
          lead.email,
          lead.phone || "",
          lead.status,
          new Date(lead.created_at).toISOString(),
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="leads-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  }

  if (type === "conversations") {
    const { data, error } = await supabase
      .from("messages")
      .select("session_id, role, content, created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }

    if (format === "csv") {
      const csv = [
        ["Session ID", "Role", "Content", "Created At"],
        ...data.map((msg) => [
          msg.session_id || "",
          msg.role,
          msg.content.replace(/"/g, '""'),
          new Date(msg.created_at).toISOString(),
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="conversations-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
}
