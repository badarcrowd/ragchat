"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";

type ExportDataProps = {
  tenantId?: string;
};

export function ExportData({ tenantId = "default" }: ExportDataProps) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleExport(format: "csv" | "json", type: "conversations" | "leads" | "analytics") {
    setExporting(true);
    setMessage(`Preparing ${type} export...`);

    try {
      const params = new URLSearchParams({
        tenantId,
        format,
        type,
      });

      const response = await fetch(`/api/admin/export?${params}`);
      
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage(`✅ ${type} exported successfully`);
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("❌ Export failed. Please try again.");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Download className="h-5 w-5 text-coral" /> Export Data
      </h2>

      {message && (
        <div className="mt-3 rounded-lg border border-line bg-neutral-50 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center gap-2 text-moss">
            <MessageCircle className="h-5 w-5" />
            <h3 className="font-semibold">Conversations</h3>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            Export all chat messages and sessions
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("csv", "conversations")}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("json", "conversations")}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <FileJson className="h-3 w-3" />
              JSON
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center gap-2 text-coral">
            <Users className="h-5 w-5" />
            <h3 className="font-semibold">Leads</h3>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            Export all captured leads and contact info
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("csv", "leads")}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("json", "leads")}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <FileJson className="h-3 w-3" />
              JSON
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <BarChart3 className="h-5 w-5" />
            <h3 className="font-semibold">Analytics</h3>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            Export usage statistics and metrics
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleExport("csv", "analytics")}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3 w-3" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("json", "analytics")}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <FileJson className="h-3 w-3" />
              JSON
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs text-neutral-600">
          <strong>Export formats:</strong> CSV for spreadsheet analysis, JSON for programmatic use and data migration
        </p>
      </div>
    </div>
  );
}

function MessageCircle(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>;
}

function Users(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function BarChart3(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;
}
