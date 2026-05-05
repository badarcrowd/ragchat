import "server-only";

const PAGESPEED_API =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type AuditIssue = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  estimatedImpact?: string;
};

export type AuditMetrics = {
  fcp: number;  // First Contentful Paint (ms)
  lcp: number;  // Largest Contentful Paint (ms)
  cls: number;  // Cumulative Layout Shift
  tbt: number;  // Total Blocking Time (ms)
};

export type AuditResult = {
  url: string;
  performanceScore: number;
  mobileScore: number;
  desktopScore: number;
  issues: AuditIssue[];
  metrics: AuditMetrics;
  summary: string;
};

function extractIssues(audits: Record<string, {
  score: number | null;
  displayValue?: string;
  numericValue?: number;
}>): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if ((audits["speed-index"]?.score ?? 1) < 0.5) {
    issues.push({
      title: "Slow page load speed",
      description: `Speed index: ${audits["speed-index"]?.displayValue ?? "unknown"}`,
      impact: "high",
      estimatedImpact: "~20–30% bounce rate increase"
    });
  }

  if ((audits["render-blocking-resources"]?.score ?? 1) < 0.5) {
    issues.push({
      title: "Render-blocking resources",
      description: "Scripts or stylesheets blocking first paint",
      impact: "high",
      estimatedImpact: "Up to 3s added load time"
    });
  }

  if ((audits["uses-optimized-images"]?.score ?? 1) < 0.5) {
    issues.push({
      title: "Unoptimised images",
      description:
        audits["uses-optimized-images"]?.displayValue ?? "Images not compressed",
      impact: "medium",
      estimatedImpact: "~15% slower page loads"
    });
  }

  if ((audits["unused-javascript"]?.score ?? 1) < 0.5) {
    issues.push({
      title: "Unused JavaScript",
      description:
        audits["unused-javascript"]?.displayValue ?? "Unused JS bundles detected",
      impact: "medium",
      estimatedImpact: "Delays time-to-interactive"
    });
  }

  if ((audits["cumulative-layout-shift"]?.score ?? 1) < 0.7) {
    issues.push({
      title: "Layout instability (CLS)",
      description: `Score: ${audits["cumulative-layout-shift"]?.displayValue ?? "high"}`,
      impact: "medium",
      estimatedImpact: "Poor UX + Google ranking penalty"
    });
  }

  if ((audits["largest-contentful-paint"]?.score ?? 1) < 0.5) {
    issues.push({
      title: "Slow largest content paint",
      description: `LCP: ${audits["largest-contentful-paint"]?.displayValue ?? "unknown"}`,
      impact: "high",
      estimatedImpact: "Core Web Vital failure — affects Google rankings"
    });
  }

  return issues.slice(0, 3);
}

export async function runPageSpeedAudit(rawUrl: string): Promise<AuditResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PAGESPEED_API_KEY not configured");

  // Normalise URL
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const buildUrl = (strategy: "mobile" | "desktop") =>
    `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${apiKey}`;

  const [mobileRes, desktopRes] = await Promise.all([
    fetch(buildUrl("mobile"), { signal: AbortSignal.timeout(15_000) }),
    fetch(buildUrl("desktop"), { signal: AbortSignal.timeout(15_000) })
  ]);

  if (!mobileRes.ok || !desktopRes.ok) {
    throw new Error(
      `PageSpeed API error: mobile=${mobileRes.status} desktop=${desktopRes.status}`
    );
  }

  const [mobile, desktop] = await Promise.all([
    mobileRes.json(),
    desktopRes.json()
  ]);

  const mobileScore = Math.round(
    (mobile.lighthouseResult?.categories?.performance?.score ?? 0) * 100
  );
  const desktopScore = Math.round(
    (desktop.lighthouseResult?.categories?.performance?.score ?? 0) * 100
  );
  const performanceScore = Math.round((mobileScore + desktopScore) / 2);

  const audits = mobile.lighthouseResult?.audits ?? {};
  const issues = extractIssues(audits);

  const metrics: AuditMetrics = {
    fcp: Math.round(audits["first-contentful-paint"]?.numericValue ?? 0),
    lcp: Math.round(audits["largest-contentful-paint"]?.numericValue ?? 0),
    cls:
      Math.round((audits["cumulative-layout-shift"]?.numericValue ?? 0) * 1000) /
      1000,
    tbt: Math.round(audits["total-blocking-time"]?.numericValue ?? 0)
  };

  let summary: string;
  if (mobileScore >= 90) {
    summary = `Strong performance (mobile: ${mobileScore}/100). Minor optimisations possible.`;
  } else if (mobileScore >= 50) {
    summary = `Moderate performance (mobile: ${mobileScore}/100). ${issues.length} issues reducing conversions.`;
  } else {
    summary = `Critical performance issues (mobile: ${mobileScore}/100). Estimated ~40% visitor drop-off.`;
  }

  return {
    url,
    performanceScore,
    mobileScore,
    desktopScore,
    issues,
    metrics,
    summary
  };
}
