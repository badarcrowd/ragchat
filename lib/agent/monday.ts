import "server-only";
import type { LeadFormData } from "@/lib/agent/lead-score";
import type { LeadScoreResult } from "@/lib/agent/lead-score";

const MONDAY_API_URL = "https://api.monday.com/v2";

export type MondaySyncPayload = {
  form: LeadFormData;
  score: LeadScoreResult;
  aiSummary: string;
  sessionId: string;
};

function escapeGql(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export async function syncLeadToMonday(
  payload: MondaySyncPayload
): Promise<{ id: string; skipped?: boolean }> {
  const token = process.env.MONDAY_API_TOKEN;
  const boardId = process.env.MONDAY_BOARD_ID;

  if (!token || !boardId) {
    console.warn(
      "[Monday.com] MONDAY_API_TOKEN or MONDAY_BOARD_ID not set — skipping CRM sync"
    );
    return { id: "not_configured", skipped: true };
  }

  const { form, score, aiSummary } = payload;

  // Build column values object matching your board's column IDs
  // Adjust column IDs to match your actual monday.com board configuration
  const columnValues = {
    email: { email: form.email ?? "", text: form.email ?? "" },
    text: form.company ?? "",
    text1: form.website ?? "",
    text2: form.sector ?? "",
    text3: form.budget ?? "",
    long_text: { text: escapeGql(aiSummary) },
    numbers: score.score,
    status: {
      label:
        score.tier === "hot" ? "Hot" : score.tier === "warm" ? "Warm" : "Cold"
    }
  };

  const mutation = `
    mutation {
      create_item(
        board_id: ${boardId},
        item_name: "${escapeGql(form.name ?? "Unknown")}",
        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
      ) {
        id
      }
    }
  `;

  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token
    },
    body: JSON.stringify({ query: mutation }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(
      `Monday.com API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (data.errors?.length) {
    throw new Error(
      `Monday.com GraphQL error: ${JSON.stringify(data.errors[0])}`
    );
  }

  const itemId: string = data.data?.create_item?.id ?? "unknown";
  return { id: itemId };
}
