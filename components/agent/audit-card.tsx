"use client";

import type { AuditResult } from "@/lib/agent/pagespeed";
import { AlertTriangle, CheckCircle, TrendingDown, Zap } from "lucide-react";

type Props = { audit: AuditResult };

const scoreColor = (n: number) =>
  n >= 90 ? "text-emerald-600" : n >= 50 ? "text-amber-500" : "text-red-500";
const scoreBg = (n: number) =>
  n >= 90 ? "bg-emerald-50 border-emerald-200" : n >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

const impactColor: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700"
};

export function AuditCard({ audit }: Props) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${scoreBg(audit.mobileScore)}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-neutral-800">Website Audit</span>
        <span className="ml-auto text-xs text-neutral-500 truncate max-w-[140px]">{audit.url}</span>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Overall", value: audit.performanceScore },
          { label: "Mobile", value: audit.mobileScore },
          { label: "Desktop", value: audit.desktopScore }
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-white border border-neutral-200 p-2 text-center">
            <div className={`text-xl font-bold ${scoreColor(value)}`}>{value}</div>
            <div className="text-xs text-neutral-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
        {[
          { k: "FCP", v: `${(audit.metrics.fcp / 1000).toFixed(1)}s`, label: "First Paint" },
          { k: "LCP", v: `${(audit.metrics.lcp / 1000).toFixed(1)}s`, label: "Largest Paint" },
          { k: "TBT", v: `${audit.metrics.tbt}ms`, label: "Blocking Time" },
          { k: "CLS", v: `${audit.metrics.cls}`, label: "Layout Shift" }
        ].map(({ k, v, label }) => (
          <div key={k} className="flex justify-between bg-white/70 rounded px-2 py-1">
            <span className="font-mono font-medium text-neutral-700">{k}</span>
            <span className="text-neutral-500">{v} <span className="text-neutral-400 text-[10px]">({label})</span></span>
          </div>
        ))}
      </div>

      {/* Issues */}
      {audit.issues.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Top Issues</p>
          {audit.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/80 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-neutral-800">{issue.title}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${impactColor[issue.impact]}`}>
                    {issue.impact}
                  </span>
                </div>
                {issue.estimatedImpact && (
                  <p className="text-neutral-500 mt-0.5">{issue.estimatedImpact}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {audit.issues.length === 0 && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-xs">No critical issues found — great foundation!</span>
        </div>
      )}

      {/* Summary */}
      <p className="mt-3 text-xs text-neutral-600 italic border-t border-neutral-200 pt-2">
        <TrendingDown className="h-3 w-3 inline mr-1 text-neutral-400" />
        {audit.summary}
      </p>
    </div>
  );
}
