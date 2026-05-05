export type LeadFormData = {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  sector?: string;
  challenge?: string;
  success?: string;
  budget?: string;
  phone?: string;
  location?: string;
  start?: string;
  rfp?: string;
};

export type LeadScoreBreakdown = {
  websiteQuality: number;  // 0–25
  budgetLevel: number;     // 0–40
  intentStrength: number;  // 0–25
  sectorFit: number;       // 0–10
};

export type LeadScoreResult = {
  score: number;  // 0–100
  tier: "hot" | "warm" | "cold";
  breakdown: LeadScoreBreakdown;
  recommendation: string;
  bookingPriority: "immediate" | "within_week" | "nurture";
};

const HIGH_VALUE_SECTORS = [
  "ecommerce",
  "e-commerce",
  "saas",
  "fintech",
  "healthtech",
  "healthcare",
  "real estate",
  "proptech",
  "retail",
  "fashion",
  "hospitality"
];

const HIGH_INTENT_KEYWORDS =
  /\b(urgent|asap|immediately|this week|this month|ready to start|budget approved|need help now|deadline|launch|struggling|rfp|approved|shortlist)\b/i;
const MEDIUM_INTENT_KEYWORDS =
  /\b(considering|planning|looking for|interested in|evaluating|exploring|would like to|next quarter|soon)\b/i;

function parseBudgetScore(budget: string): number {
  const b = budget.toLowerCase().replace(/[,\s]/g, "");

  // Extract numeric value
  const match = b.match(/(\d+(?:\.\d+)?)\s*k?/);
  if (!match) return 5;

  let value = parseFloat(match[1]);
  if (b.includes("k") && value < 1000) value *= 1000;

  if (value >= 50_000) return 40;
  if (value >= 20_000) return 30;
  if (value >= 10_000) return 22;
  if (value >= 5_000) return 15;
  return 5;
}

export function scoreLead(
  form: LeadFormData,
  auditScore?: number
): LeadScoreResult {
  // Website quality (0–25)
  const websiteQuality =
    auditScore !== undefined ? Math.round((auditScore / 100) * 25) : 10;

  // Budget level (0–40)
  const budgetLevel = form.budget ? parseBudgetScore(form.budget) : 0;

  // Intent strength (0–25)
  let intentStrength = 0;
  const challenge = [form.challenge, form.success, form.start, form.rfp]
    .filter(Boolean)
    .join(" ");
  if (HIGH_INTENT_KEYWORDS.test(challenge)) intentStrength = 25;
  else if (MEDIUM_INTENT_KEYWORDS.test(challenge)) intentStrength = 15;
  else if (challenge.length > 100) intentStrength = 12;
  else if (challenge.length > 30) intentStrength = 8;

  // Sector fit (0–10)
  const sector = form.sector?.toLowerCase() ?? "";
  const sectorFit = HIGH_VALUE_SECTORS.some((s) => sector.includes(s)) ? 10 : sector ? 5 : 0;

  const score = Math.min(
    websiteQuality + budgetLevel + intentStrength + sectorFit,
    100
  );

  let tier: "hot" | "warm" | "cold";
  let bookingPriority: "immediate" | "within_week" | "nurture";
  let recommendation: string;

  if (score >= 70) {
    tier = "hot";
    bookingPriority = "immediate";
    recommendation =
      "High-priority lead — book a strategy call immediately and assign a senior consultant.";
  } else if (score >= 40) {
    tier = "warm";
    bookingPriority = "within_week";
    recommendation =
      "Good potential — nurture with case studies and schedule an intro call this week.";
  } else {
    tier = "cold";
    bookingPriority = "nurture";
    recommendation =
      "Early stage — offer a free audit report or webinar, follow up in 2 weeks.";
  }

  return {
    score,
    tier,
    breakdown: { websiteQuality, budgetLevel, intentStrength, sectorFit },
    recommendation,
    bookingPriority
  };
}

export type BudgetTierResult = {
  tier: "too_low" | "starter" | "growth" | "enterprise";
  label: string;
  message: string;
  suggestion: string;
};

export function evaluateBudget(budget: string): BudgetTierResult {
  const b = budget.toLowerCase().replace(/[,\s]/g, "");
  const match = b.match(/(\d+(?:\.\d+)?)\s*k?/);
  if (!match) {
    return {
      tier: "starter",
      label: "Undefined",
      message: "Could you share a rough budget range?",
      suggestion: "Even a ballpark helps us recommend the right starting point."
    };
  }

  let value = parseFloat(match[1]);
  if (b.includes("k") && value < 1000) value *= 1000;

  if (value < 5_000) {
    return {
      tier: "too_low",
      label: "Under $5k",
      message:
        "Budgets under $5k limit what we can meaningfully achieve together.",
      suggestion:
        "We have a Starter Audit from $2,500 or a free 30-min strategy call to explore options."
    };
  }
  if (value < 15_000) {
    return {
      tier: "starter",
      label: "$5k–$15k",
      message: "$5k–$15k supports a focused SEO sprint or paid ads setup.",
      suggestion:
        "We can prioritise 2–3 high-impact channels and deliver measurable results within 90 days."
    };
  }
  if (value < 50_000) {
    return {
      tier: "growth",
      label: "$15k–$50k",
      message:
        "$15k–$50k is the sweet spot for full-funnel performance marketing + CRO.",
      suggestion:
        "This budget unlocks multi-channel campaigns, landing page optimisation, and monthly reporting."
    };
  }
  return {
    tier: "enterprise",
    label: "$50k+",
    message:
      "$50k+ unlocks a full-scale growth programme with dedicated account management.",
    suggestion:
      "We'd recommend a strategy session to build a custom 6–12 month roadmap."
  };
}
