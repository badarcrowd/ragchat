import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function getIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function rateLimit(
  request: Request,
  scope: string,
  maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 30),
  windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60)
) {
  const identifier = `${scope}:${getIp(request)}`;

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      identifier,
      window_seconds: windowSeconds,
      max_requests: maxRequests
    });

    if (error) {
      throw error;
    }

    if (data === false) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    return null;
  } catch {
    const now = Date.now();
    const resetAt = now + windowSeconds * 1000;
    const bucket = memoryBuckets.get(identifier);

    if (!bucket || bucket.resetAt < now) {
      memoryBuckets.set(identifier, { count: 1, resetAt });
      return null;
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    return null;
  }
}
