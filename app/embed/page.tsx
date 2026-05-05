import { EmbedAgent } from "@/components/agent/embed-agent";

// No layout chrome — renders only the floating agent, designed to be used inside an iframe
export const metadata = {
  title: "Crowd Agent",
};

export default function EmbedPage() {
  return <EmbedAgent />;
}
