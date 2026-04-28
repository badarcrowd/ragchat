import { z } from "zod";

export const hubspotLeadSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email().max(320),
  phone: z.string().max(60).optional().nullable(),
  tenantId: z.string().min(1).max(160).default("default"),
  sessionId: z.string().uuid().optional().nullable()
});

export type HubSpotLead = z.infer<typeof hubspotLeadSchema>;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstname: parts[0] ?? "",
    lastname: parts.slice(1).join(" ")
  };
}

async function hubspotFetch(
  path: string,
  init: RequestInit,
  retries = Number(process.env.HUBSPOT_MAX_RETRIES ?? 3)
) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Missing HUBSPOT_ACCESS_TOKEN");
  }

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      const response = await fetch(`https://api.hubapi.com${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          ...(init.headers ?? {})
        }
      });

      if (response.ok || response.status === 404 || response.status === 409) {
        return response;
      }

      lastError = new Error(
        `HubSpot request failed with ${response.status}: ${await response.text()}`
      );
    } catch (error) {
      lastError = error;
    }

    attempt += 1;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(2000, 250 * 2 ** attempt))
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("HubSpot request failed");
}

export async function syncLeadToHubSpot(lead: HubSpotLead) {
  const { firstname, lastname } = splitName(lead.name);
  const properties = {
    email: lead.email,
    firstname,
    lastname,
    phone: lead.phone ?? "",
    agent_rag_tenant_id: lead.tenantId,
    agent_rag_session_id: lead.sessionId ?? ""
  };

  const patch = await hubspotFetch(
    `/crm/v3/objects/contacts/${encodeURIComponent(
      lead.email
    )}?idProperty=email`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties })
    }
  );

  if (patch.ok) {
    return (await patch.json()) as { id: string };
  }

  const create = await hubspotFetch("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties })
  });

  if (!create.ok) {
    throw new Error(`HubSpot contact create failed: ${await create.text()}`);
  }

  return (await create.json()) as { id: string };
}
