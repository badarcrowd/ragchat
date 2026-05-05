import { CrowdAgent } from "@/components/agent/crowd-agent";

export const metadata = {
  title: "Get a Free Growth Audit | Crowd Digital",
  description:
    "Talk to our AI voice consultant. Get a real-time website audit, personalised recommendations, and book a strategy call in under 2 minutes."
};

export default function ContactPage() {
  return (
    <>
      {/* Page content */}
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5 text-sm text-indigo-700 font-medium mb-8">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Voice Consultant · Available Now
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight mb-4 leading-tight">
            Get Your Free<br />
            <span className="text-indigo-600">Growth Audit</span>
          </h1>

          <p className="text-lg text-neutral-500 max-w-xl mx-auto mb-10">
            Talk to Crowd Agent — our AI voice consultant. In under 60 seconds
            it will audit your website, identify growth gaps, and recommend a
            plan tailored to your business.
          </p>

          {/* Mic hint */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Tap the mic button in the bottom-right to start
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-3xl mx-auto px-6 pb-32 grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: "🔍",
              title: "Live Website Audit",
              desc: "Real PageSpeed analysis with actionable business-impact scores delivered instantly."
            },
            {
              icon: "🎯",
              title: "Lead Scoring",
              desc: "Instant qualification with a personalised growth recommendation tailored to your goals."
            },
            {
              icon: "📅",
              title: "Instant Booking",
              desc: "Book a strategy call with our team directly inside the conversation."
            }
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-neutral-200 p-5 text-center shadow-sm"
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-neutral-800 mb-1 text-sm">
                {card.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </section>
      </main>

      {/* Floating voice agent widget */}
      <CrowdAgent />
    </>
  );
}
