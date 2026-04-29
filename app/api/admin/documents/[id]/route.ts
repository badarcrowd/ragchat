import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/security/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimit(request, "admin", 60, 60);
  if (limited) {
    return limited;
  }

  const { id } = await params;
  const supabase = createSupabaseAdmin();

  // Delete document (chunks will be cascade deleted)
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
