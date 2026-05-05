"use client";

import type { LeadScoreResult } from "@/lib/agent/lead-score";
import type { BudgetTierResult } from "@/lib/agent/lead-score";
import { Flame, TrendingUp, Info, DollarSign } from "lucide-react";

const tierStyle: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  hot: { bg: "bg-red-50 border-red-200", text: "text-red-700", icon: Flame },
  warm: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: TrendingUp },
  cold: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: Info }
};

export function LeadScoreCard({ score }: { score: LeadScoreResult }) {
  const style = tierStyle[score.tier];
  const Icon = style.icon;

  return (
    <div className={`rounded-xl border p-4 text-sm ${style.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${style.text} shrink-0`} />
        <span className="font-semibold text-neutral-800">Lead Score</span>
        <span className={`ml-auto text-2xl font-bold ${style.text}`}>{score.score}<span className="text-sm font-normal">/100</span></span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
        {[
          { label: "Website Quality", value: score.breakdown.websiteQuality, max: 25 },
          { label: "Budget Level", value: score.breakdown.budgetLevel, max: 40 },
          { label: "Intent Strength", value: score.breakdown.intentStrength, max: 25 },
          { label: "Sector Fit", value: score.breakdown.sectorFit, max: 10 }
        ].map(({ label, value, max }) => (
          <div key={label} className="bg-white/70 rounded px-2 py-1.5">
            <div className="flex justify-between mb-1">
              <span className="text-neutral-600">{label}</span>
              <span className="font-medium">{value}/{max}</span>
            </div>
            <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${style.text.replace("text", "bg")}`}
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-lg px-3 py-2 text-xs ${style.bg} border ${style.bg.split(" ")[1]}`}>
        <span className={`font-semibold uppercase mr-1 ${style.text}`}>{score.tier.toUpperCase()}</span>
        {score.recommendation}
      </div>
    </div>
  );
}

export function BudgetCard({ budget }: { budget: BudgetTierResult }) {
  const tierColors: Record<string, string> = {
    too_low: "bg-red-50 border-red-200",
    starter: "bg-blue-50 border-blue-200",
    growth: "bg-emerald-50 border-emerald-200",
    enterprise: "bg-purple-50 border-purple-200"
  };

  return (
    <div className={`rounded-xl border p-4 text-sm ${tierColors[budget.tier] ?? "bg-neutral-50 border-neutral-200"}`}>
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-4 w-4 text-neutral-500 shrink-0" />
        <span className="font-semibold text-neutral-800">Budget Analysis</span>
        <span className="ml-auto text-xs font-medium text-neutral-600 bg-white/70 px-2 py-0.5 rounded-full">
          {budget.label}
        </span>
      </div>
      <p className="text-neutral-700 mb-2">{budget.message}</p>
      <p className="text-neutral-500 text-xs">{budget.suggestion}</p>
    </div>
  );
}
