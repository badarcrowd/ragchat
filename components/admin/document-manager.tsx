"use client";

import { useState } from "react";
import { FileText, Link as LinkIcon, RefreshCw, Trash2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { DocumentRow } from "@/lib/types";

type DocumentManagerProps = {
  initialDocuments: DocumentRow[];
};

export function DocumentManager({ initialDocuments }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("");
  const pageSize = 10;

  const filteredDocs = documents.filter((doc) =>
    (doc.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (doc.source_url?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredDocs.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedDocs = filteredDocs.slice(startIndex, startIndex + pageSize);

  async function deleteDocument(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete "${title || "Untitled"}"? This will remove all associated chunks.`)) {
      return;
    }

    setStatus(`Deleting ${title || "document"}...`);
    try {
      const response = await fetch(`/api/admin/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      setStatus(`✅ Successfully deleted ${title || "document"}`);
      setTimeout(() => setStatus(""), 3000);
    } catch {
      setStatus("❌ Failed to delete document");
      setTimeout(() => setStatus(""), 3000);
    }
  }

  async function reindexDocument(id: string, title: string) {
    setStatus(`Re-indexing ${title || "document"}...`);
    try {
      const response = await fetch("/api/admin/reindex", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to reindex");
      }

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? { ...doc, chunk_count: payload.chunks, status: "indexed" }
            : doc
        )
      );
      setStatus(`✅ Re-indexed ${payload.chunks} chunks`);
      setTimeout(() => setStatus(""), 3000);
    } catch {
      setStatus("❌ Failed to re-index");
      setTimeout(() => setStatus(""), 3000);
    }
  }

  return (
    <div className="rounded-md border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-coral" /> Document Management
        </h2>
        <div className="text-sm text-neutral-500">
          {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""}
        </div>
      </div>

      {status && (
        <div className="mt-3 rounded-lg border border-line bg-neutral-50 px-3 py-2 text-sm">
          {status}
        </div>
      )}

      <div className="mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search documents by title or URL..."
            className="w-full rounded-md border border-line py-2 pl-10 pr-3 text-sm outline-none focus:border-moss"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Chunks</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDocs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-500">
                  {searchTerm ? "No documents match your search" : "No documents indexed yet"}
                </td>
              </tr>
            ) : (
              paginatedDocs.map((document) => (
                <tr key={document.id} className="border-b border-line last:border-b-0 hover:bg-neutral-50">
                  <td className="max-w-[300px] py-3 pr-3">
                    <div className="truncate font-medium">
                      {document.title || "Untitled"}
                    </div>
                    {document.source_url && (
                      <a
                        href={document.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-moss hover:underline"
                      >
                        <LinkIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{document.source_url}</span>
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                      {document.type}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">{document.chunk_count}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        document.status === "indexed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {document.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => reindexDocument(document.id, document.title || "document")}
                        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium transition-colors hover:border-moss hover:bg-moss/5 hover:text-moss"
                        title="Re-index document"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Re-index
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDocument(document.id, document.title || "document")}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                        title="Delete document"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
