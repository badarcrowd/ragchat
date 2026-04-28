import { ChatWidget } from "@/components/chat/chat-widget";
import { createSupabaseAdmin } from "@/lib/supabase";
import { sanitizeTenantId } from "@/lib/rag";

type ChatPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = await searchParams;
  const embed = readParam(params, "embed") === "1";
  const domain = readParam(params, "domain");
  const tenantId = readParam(params, "tenantId");
  const brandColorParam = readParam(params, "brandColor");

  // Fetch brand color from settings
  let brandColor = brandColorParam;
  if (!brandColor) {
    try {
      const supabase = createSupabaseAdmin();
      const effectiveTenant = tenantId ?? (domain === 'localhost' ? 'default' : domain);
      const tid = sanitizeTenantId(effectiveTenant);
      
      const { data } = await supabase
        .from("settings")
        .select("metadata")
        .eq("tenant_id", tid)
        .maybeSingle();
      
      if (data?.metadata && typeof data.metadata === 'object') {
        brandColor = (data.metadata as { brand_color?: string }).brand_color || "#2f6b4f";
      } else {
        brandColor = "#2f6b4f";
      }
    } catch {
      brandColor = "#2f6b4f";
    }
  }

  return (
    <main
      className={
        embed
          ? "min-h-screen bg-transparent"
          : "min-h-screen bg-wheat px-4 py-8 text-ink"
      }
    >
      <ChatWidget
        embed={embed}
        initialDomain={domain}
        initialTenantId={tenantId}
        brandColor={brandColor}
      />
    </main>
  );
}
