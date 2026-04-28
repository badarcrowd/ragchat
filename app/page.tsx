import Link from "next/link";
import { ArrowRight, Bot, Database, LineChart } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-wheat text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-moss">
              RAG chatbot platform
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
              Deploy a grounded AI assistant on any website.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">
              Crawl pages, upload documents, stream multilingual answers with
              citations, capture leads, sync HubSpot, and monitor usage from a
              protected admin console.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white"
              >
                Open chat <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold"
              >
                Admin dashboard
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              {
                icon: Bot,
                title: "Streaming RAG",
                body: "OpenAI responses grounded in top pgvector matches."
              },
              {
                icon: Database,
                title: "Supabase native",
                body: "Documents, chunks, sessions, messages, and leads."
              },
              {
                icon: LineChart,
                title: "SaaS telemetry",
                body: "Daily query volume, popular questions, and CRM status."
              }
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-md border border-line bg-white p-5 shadow-sm"
              >
                <item.icon className="h-5 w-5 text-coral" />
                <h2 className="mt-3 font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-neutral-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
