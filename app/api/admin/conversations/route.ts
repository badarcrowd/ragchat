import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeTenantId } from "@/lib/rag";

export async function GET(request: Request) {
  const limited = await rateLimit(request, "admin", 60, 60);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const tenantId = sanitizeTenantId(searchParams.get("tenantId") || "default");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");
  
  const supabase = createSupabaseAdmin();
  
  const offset = (page - 1) * pageSize;

  const [{ data: messages, error }, { count }] = await Promise.all([
    supabase
      .from("messages")
      .select(`
        id,
        role,
        content,
        response_time_ms,
        created_at,
        session_id,
        sources
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    messages,
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  });
}
