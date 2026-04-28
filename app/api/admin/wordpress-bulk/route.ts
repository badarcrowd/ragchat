import { NextResponse } from "next/server";
import { crawlWordPressSite } from "@/lib/wordpress";
import { indexDocument, sanitizeTenantId } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for bulk operations

export async function POST(request: Request) {
  const form = await request.formData();
  const tenantId = sanitizeTenantId(String(form.get("tenantId") ?? "default"));
  const siteUrl = String(form.get("siteUrl") ?? "").trim();
  const customPostTypesStr = String(form.get("customPostTypes") ?? "").trim();
  const autoDiscover = form.get("autoDiscover") !== "false"; // Default to true

  if (!siteUrl) {
    return NextResponse.json(
      { error: "WordPress site URL is required" },
      { status: 400 }
    );
  }

  try {
    const url = new URL(siteUrl);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Parse custom post types (comma-separated)
    const customPostTypes = customPostTypesStr
      ? customPostTypesStr.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    console.log(`[WordPress Bulk] Starting crawl of ${baseUrl}`);
    console.log(`[WordPress Bulk] Auto-discover: ${autoDiscover}`);
    console.log(`[WordPress Bulk] Custom post types: ${customPostTypes.join(', ') || 'none'}`);
    
    const items = await crawlWordPressSite(baseUrl, {
      customPostTypes,
      autoDiscover
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No content found. This might not be a WordPress site or the API is disabled." },
        { status: 404 }
      );
    }

    console.log(`[WordPress Bulk] Found ${items.length} items, indexing...`);

    const results = [];
    const typeStats: Record<string, number> = {};
    
    for (const item of items) {
      try {
        const result = await indexDocument({
          tenantId,
          title: item.title,
          sourceUrl: item.url,
          type: "url",
          text: item.text,
          metadata: {
            indexed_via: "wordpress_bulk",
            site_url: baseUrl,
            post_type: item.type
          }
        });
        results.push(result);
        typeStats[item.type] = (typeStats[item.type] || 0) + 1;
      } catch (error) {
        console.error(`[WordPress Bulk] Failed to index ${item.url}:`, error);
      }
    }

    console.log(`[WordPress Bulk] Successfully indexed ${results.length}/${items.length} items`);
    console.log(`[WordPress Bulk] By type:`, typeStats);

    return NextResponse.json({
      success: true,
      total: items.length,
      indexed: results.length,
      failed: items.length - results.length,
      byType: typeStats,
      documents: results
    });
  } catch (error) {
    console.error("[WordPress Bulk Error]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "WordPress bulk crawl failed"
      },
      { status: 500 }
    );
  }
}
