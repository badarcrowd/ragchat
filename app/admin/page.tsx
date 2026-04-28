import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { createSupabaseAdmin } from "@/lib/supabase";
import type {
  AdminAnalytics,
  AdminDashboardData,
  DocumentRow,
  LeadRow
} from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeQuestion(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

async function loadDashboardData(): Promise<AdminDashboardData> {
  const supabase = createSupabaseAdmin();
  const since = new Date();
  since.setDate(since.getDate() - 13);

  const [
    documents,
    chunks,
    leads,
    messages,
    recentDocuments,
    recentLeads,
    settings
  ] = await Promise.all([
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase.from("chunks").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("messages").select("*", { count: "exact", head: true }),
    supabase
      .from("documents")
      .select("id, tenant_id, title, source_url, type, status, chunk_count, created_at, indexed_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("leads")
      .select("id, tenant_id, name, email, phone, status, hubspot_contact_id, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("settings").select("*").eq("tenant_id", "default").maybeSingle()
  ]);

  const queryRows = await supabase
    .from("messages")
    .select("content, created_at")
    .eq("role", "user")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(1000);

  const buckets = new Map<string, number>();
  for (let index = 0; index < 14; index += 1) {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - (13 - index));
    buckets.set(dayKey(date), 0);
  }

  const popular = new Map<string, number>();
  for (const row of queryRows.data ?? []) {
    const key = dayKey(new Date(row.created_at));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    const question = normalizeQuestion(row.content);
    popular.set(question, (popular.get(question) ?? 0) + 1);
  }

  const analytics: AdminAnalytics = {
    dailyQueries: [...buckets.entries()].map(([date, count]) => ({
      date,
      count
    })),
    topQuestions: [...popular.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([question, count]) => ({ question, count }))
  };

  return {
    stats: {
      documents: documents.count ?? 0,
      chunks: chunks.count ?? 0,
      leads: leads.count ?? 0,
      messages: messages.count ?? 0
    },
    documents: (recentDocuments.data ?? []) as DocumentRow[],
    leads: (recentLeads.data ?? []) as LeadRow[],
    settings: {
      systemPrompt:
        settings.data?.system_prompt ??
        "You are a concise, accurate support assistant. Answer only from the supplied context.",
      leadCaptureAfterMessages:
        settings.data?.lead_capture_after_messages ??
        Number(process.env.LEAD_CAPTURE_AFTER_MESSAGES ?? 3),
      allowedDomains: settings.data?.allowed_domains ?? [],
      brandColor: (settings.data?.metadata as any)?.brand_color ?? "#2f6b4f"
    },
    analytics
  };
}

export default async function AdminPage() {
  try {
    const data = await loadDashboardData();
    return <AdminDashboard data={data} />;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load dashboard data.";
    return (
      <main className="min-h-screen bg-wheat px-6 py-10 text-ink">
        <div className="mx-auto max-w-3xl rounded-md border border-line bg-white p-6">
          <h1 className="text-2xl font-semibold">Admin setup required</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-700">{message}</p>
          <p className="mt-3 text-sm leading-6 text-neutral-700">
            Add the Supabase environment variables from `.env.example`, run the
            SQL schema, then reload this page.
          </p>
        </div>
      </main>
    );
  }
}
