import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent RAG Chatbot",
  description: "Embeddable RAG chatbot SaaS with Supabase pgvector and OpenAI."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
