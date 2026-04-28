import { NextResponse } from "next/server";
import {
  crawlUrl,
  extractPdfText,
  indexDocument,
  normalizeText,
  sanitizeTenantId
} from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const tenantId = sanitizeTenantId(String(form.get("tenantId") ?? "default"));
  const url = String(form.get("url") ?? "").trim();
  const pastedText = String(form.get("text") ?? "").trim();
  const file = form.get("file");

  try {
    if (url) {
      const crawled = await crawlUrl(url);
      const result = await indexDocument({
        tenantId,
        title: crawled.title,
        sourceUrl: crawled.url,
        type: "url",
        text: crawled.text,
        metadata: { indexed_via: "admin_url" }
      });
      return NextResponse.json(result);
    }

    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const text = isPdf ? await extractPdfText(buffer) : normalizeText(await file.text());
      const result = await indexDocument({
        tenantId,
        title: file.name,
        sourceUrl: null,
        type: isPdf ? "pdf" : "text",
        text,
        metadata: {
          file_name: file.name,
          file_type: file.type,
          indexed_via: "admin_upload"
        }
      });
      return NextResponse.json(result);
    }

    if (pastedText) {
      const result = await indexDocument({
        tenantId,
        title: "Pasted text",
        sourceUrl: null,
        type: "text",
        text: pastedText,
        metadata: { indexed_via: "admin_text" }
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Provide a URL, file, or text to index." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Ingest Error]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ingestion failed"
      },
      { status: 500 }
    );
  }
}
