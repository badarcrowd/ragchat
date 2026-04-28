import { NextResponse } from "next/server";
import { z } from "zod";
import { reindexDocument } from "@/lib/rag";

export const runtime = "nodejs";

const schema = z.object({
  documentId: z.string().uuid()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  try {
    const result = await reindexDocument(parsed.data.documentId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Re-index failed"
      },
      { status: 500 }
    );
  }
}
