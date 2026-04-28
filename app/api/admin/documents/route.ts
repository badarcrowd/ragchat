import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sanitizeTenantId } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = sanitizeTenantId(searchParams.get("tenantId") ?? "default");

  const supabase = createSupabaseAdmin();
  
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, title, source_url, type, status, chunk_count, created_at, indexed_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents, count: documents?.length ?? 0 });
}
