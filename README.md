# Agent RAG Chatbot

Production-ready starter for an embeddable RAG chatbot SaaS using Next.js 15,
Vercel AI SDK, OpenAI, Supabase Postgres + pgvector, lead capture, HubSpot sync,
and admin analytics.

## Folder Structure

```txt
app/
  admin/page.tsx
  api/
    admin/ingest/route.ts
    admin/reindex/route.ts
    admin/settings/route.ts
    chat/route.ts
    hubspot/route.ts
    leads/route.ts
  chat/page.tsx
components/
  admin/admin-dashboard.tsx
  chat/chat-widget.tsx
lib/
  ai/language.ts
  ai/openai.ts
  analytics.ts
  env.ts
  hubspot.ts
  rag.ts
  security/rate-limit.ts
  supabase.ts
  types.ts
public/widget.js
supabase/schema.sql
```

## Setup

1. Create a Supabase project and run `supabase/schema.sql`.
2. Copy `.env.example` to `.env.local` and fill in keys.
3. Install and run:

```bash
npm install
npm run dev
```

## Embed

```html
<script>
  window.RagChatbotConfig = {
    tenantId: "example.com",
    brandColor: "#2f6b4f"
  };
</script>
<script src="https://yourdomain.com/widget.js"></script>
```

The script injects an iframe pointed at `/chat?embed=1` and resizes it as the
chat opens and closes.
