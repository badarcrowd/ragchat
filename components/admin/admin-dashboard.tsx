"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BarChart3,
  Database,
  FileText,
  Link as LinkIcon,
  RefreshCw,
  Save,
  Upload,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminDashboardData, DocumentRow } from "@/lib/types";

type AdminDashboardProps = {
  data: AdminDashboardData;
};

function StatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <Icon className="h-5 w-5 text-coral" />
      <p className="mt-4 text-3xl font-semibold">{value.toLocaleString()}</p>
      <p className="mt-1 text-sm text-neutral-600">{label}</p>
    </div>
  );
}

function maxCount(values: Array<{ count: number }>) {
  return Math.max(1, ...values.map((item) => item.count));
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  const [status, setStatus] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentRow[]>(data.documents);
  const [brandColor, setBrandColor] = useState(data.settings.brandColor);

  const maxDaily = useMemo(
    () => maxCount(data.analytics.dailyQueries),
    [data.analytics.dailyQueries]
  );

  async function ingest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Indexing content...");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/ingest", {
      method: "POST",
      body: form
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Indexing failed.");
      return;
    }

    setStatus(`Indexed ${payload.chunks} chunks.`);
    window.location.reload();
  }

  async function wordpressBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Crawling WordPress site (this may take a few minutes)...");
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/wordpress-bulk", {
      method: "POST",
      body: form
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "WordPress bulk crawl failed.");
      return;
    }

    const typeBreakdown = Object.entries(payload.byType || {})
      .map(([type, count]) => `${type}: ${count}`)
      .join(", ");
    
    setStatus(`✅ Indexed ${payload.indexed}/${payload.total} items (${typeBreakdown})`);
    setTimeout(() => window.location.reload(), 3000);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving settings...");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "default",
        systemPrompt: form.get("systemPrompt"),
        leadCaptureAfterMessages: Number(form.get("leadCaptureAfterMessages")),
        allowedDomains: String(form.get("allowedDomains") ?? "")
          .split(",")
          .map((domain) => domain.trim().toLowerCase())
          .filter(Boolean),
        brandColor: form.get("brandColor") || undefined
      })
    });
    setStatus(response.ok ? "Settings saved." : "Could not save settings.");
  }

  async function reindex(documentId: string) {
    setStatus("Re-indexing document...");
    const response = await fetch("/api/admin/reindex", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId })
    });
    const payload = await response.json();
    setStatus(
      response.ok ? `Re-indexed ${payload.chunks} chunks.` : payload.error
    );
    if (response.ok) {
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? { ...document, chunk_count: payload.chunks, status: "indexed" }
            : document
        )
      );
    }
  }

  return (
    <main className="min-h-screen bg-wheat px-4 py-6 text-ink md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-3 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold">RAG chatbot console</h1>
          </div>
          {status ? (
            <p className="rounded-md border border-line bg-white px-3 py-2 text-sm text-neutral-700">
              {status}
            </p>
          ) : null}
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Documents" value={data.stats.documents} icon={FileText} />
          <StatCard label="Chunks" value={data.stats.chunks} icon={Database} />
          <StatCard label="Messages" value={data.stats.messages} icon={BarChart3} />
          <StatCard label="Leads" value={data.stats.leads} icon={Users} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <form
              onSubmit={ingest}
              className="rounded-md border border-line bg-white p-5"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Upload className="h-5 w-5 text-coral" /> Index content
              </h2>
              <div className="mt-4 grid gap-3">
                <input
                  name="tenantId"
                  placeholder="Tenant ID or domain"
                  defaultValue="default"
                  className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                />
                <input
                  name="url"
                  placeholder="https://example.com/docs"
                  className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                />
                <textarea
                  name="text"
                  placeholder="Paste text or markdown"
                  rows={5}
                  className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                />
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.txt,.md,text/plain,application/pdf"
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white"
                >
                  <Upload className="h-4 w-4" /> Index
                </button>
              </div>
            </form>

            <form
              onSubmit={wordpressBulk}
              className="rounded-md border border-moss bg-moss/5 p-5"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Database className="h-5 w-5 text-moss" /> WordPress Bulk Import
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Automatically crawls all pages, posts, and custom post types using WordPress JSON API (bypasses Cloudflare).
              </p>
              <div className="mt-4 grid gap-3">
                <input
                  name="tenantId"
                  placeholder="Tenant ID"
                  defaultValue="default"
                  className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                />
                <input
                  name="siteUrl"
                  placeholder="https://yoursite.com"
                  className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                  required
                />
                <div>
                  <input
                    name="customPostTypes"
                    placeholder="Custom post types (e.g., portfolio,team,products)"
                    className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Optional: Add custom post type slugs separated by commas. System will auto-discover standard types.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="autoDiscover"
                    defaultChecked
                    className="h-4 w-4 rounded border-line text-moss focus:ring-moss"
                  />
                  <span>Auto-discover all post types</span>
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-moss/90"
                >
                  <Database className="h-4 w-4" /> Import All WordPress Content
                </button>
              </div>
            </form>

            <form
              onSubmit={saveSettings}
              className="rounded-md border border-line bg-white p-5"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Save className="h-5 w-5 text-coral" /> System prompt
              </h2>
              <textarea
                name="systemPrompt"
                defaultValue={data.settings.systemPrompt}
                rows={8}
                className="mt-4 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
              />
              <label className="mt-3 block text-sm font-medium">
                Lead capture after messages
              </label>
              <input
                name="leadCaptureAfterMessages"
                type="number"
                min={1}
                max={20}
                defaultValue={data.settings.leadCaptureAfterMessages}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
              />
              <label className="mt-3 block text-sm font-medium">
                Allowed embed domains
              </label>
              <input
                name="allowedDomains"
                placeholder="example.com, docs.example.com"
                defaultValue={data.settings.allowedDomains.join(", ")}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
              />
              <label className="mt-3 block text-sm font-medium">
                Brand Color
              </label>
              <div className="mt-1 flex items-center gap-3">
                <input
                  name="brandColor"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-11 w-20 cursor-pointer rounded-md border border-line"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-moss"
                  placeholder="#2f6b4f"
                  pattern="^#[0-9a-fA-F]{6}$"
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Used for chat widget buttons and branding
              </p>
              <button
                type="submit"
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <section className="rounded-md border border-line bg-white p-5">
              <h2 className="text-lg font-semibold">Daily queries</h2>
              <div className="mt-4 flex h-44 items-end gap-2">
                {data.analytics.dailyQueries.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md bg-moss"
                      style={{
                        height: `${Math.max(6, (day.count / maxDaily) * 155)}px`
                      }}
                      title={`${day.date}: ${day.count}`}
                    />
                    <span className="text-[10px] text-neutral-500">
                      {day.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="text-lg font-semibold">Top questions</h2>
                <div className="mt-4 space-y-3">
                  {data.analytics.topQuestions.length === 0 ? (
                    <p className="text-sm text-neutral-500">No queries yet.</p>
                  ) : null}
                  {data.analytics.topQuestions.map((item) => (
                    <div key={item.question} className="border-b border-line pb-3 last:border-b-0">
                      <p className="text-sm font-medium">{item.question}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {item.count} asks
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="text-lg font-semibold">Recent leads</h2>
                <div className="mt-4 space-y-3">
                  {data.leads.length === 0 ? (
                    <p className="text-sm text-neutral-500">No leads yet.</p>
                  ) : null}
                  {data.leads.map((lead) => (
                    <div key={lead.id} className="border-b border-line pb-3 last:border-b-0">
                      <p className="text-sm font-medium">{lead.name}</p>
                      <p className="text-xs text-neutral-500">{lead.email}</p>
                      <p className="text-xs text-neutral-500">
                        HubSpot: {lead.hubspot_contact_id ?? lead.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-md border border-line bg-white p-5">
              <h2 className="text-lg font-semibold">Indexed documents</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Tenant</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Chunks</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id} className="border-b border-line last:border-b-0">
                        <td className="max-w-[260px] py-3 pr-3">
                          <div className="truncate font-medium">
                            {document.title ?? "Untitled"}
                          </div>
                          {document.source_url ? (
                            <a
                              href={document.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-moss"
                            >
                              <LinkIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">{document.source_url}</span>
                            </a>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">{document.tenant_id}</td>
                        <td className="py-3 pr-3">{document.type}</td>
                        <td className="py-3 pr-3">{document.chunk_count}</td>
                        <td className="py-3 pr-3">{document.status}</td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            onClick={() => reindex(document.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold hover:border-moss hover:text-moss"
                          >
                            <RefreshCw className="h-3 w-3" /> Re-index
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
