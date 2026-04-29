"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

type Message = {
  id: string;
  role: string;
  content: string;
  response_time_ms: number | null;
  created_at: string;
  session_id: string;
  sources: unknown;
};

type ConversationViewerProps = {
  tenantId?: string;
};

export function ConversationViewer({ tenantId = "default" }: ConversationViewerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const pageSize = 50;

  async function loadMessages() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId,
        page: String(page),
        pageSize: String(pageSize),
      });

      const response = await fetch(`/api/admin/conversations?${params}`);
      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tenantId]);

  const filteredMessages = messages.filter((msg) =>
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.session_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sessionGroups = filteredMessages.reduce((acc, msg) => {
    if (!acc[msg.session_id]) {
      acc[msg.session_id] = [];
    }
    acc[msg.session_id].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  const sessionIds = Object.keys(sessionGroups);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="rounded-md border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="h-5 w-5 text-coral" /> Conversations
        </h2>
        <button
          type="button"
          onClick={loadMessages}
          className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-md border border-line py-2 pl-10 pr-3 text-sm outline-none focus:border-moss"
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-neutral-500">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin" />
          <p className="mt-2 text-sm">Loading conversations...</p>
        </div>
      ) : sessionIds.length === 0 ? (
        <div className="mt-8 text-center text-neutral-500">
          <MessageCircle className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2 text-sm">
            {searchTerm ? "No conversations match your search" : "No conversations yet"}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {sessionIds.map((sessionId) => {
            const sessionMessages = sessionGroups[sessionId];
            const isExpanded = selectedSession === sessionId;
            const lastMessage = sessionMessages[sessionMessages.length - 1];

            return (
              <div
                key={sessionId}
                className="rounded-lg border border-line bg-neutral-50"
              >
                <button
                  type="button"
                  onClick={() => setSelectedSession(isExpanded ? null : sessionId)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-neutral-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-neutral-500">
                          {sessionId.slice(0, 8)}
                        </span>
                        <span className="text-xs text-neutral-400">•</span>
                        <span className="text-xs text-neutral-500">
                          {sessionMessages.length} message{sessionMessages.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {sessionMessages.find((m) => m.role === "user")?.content.slice(0, 100) ||
                          "Session"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {new Date(lastMessage.created_at).toLocaleString()}
                      </p>
                    </div>
                    <ChevronLeft
                      className={`h-5 w-5 transform text-neutral-400 transition-transform ${
                        isExpanded ? "-rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-line bg-white px-4 py-3">
                    <div className="space-y-3">
                      {sessionMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-lg p-3 ${
                            msg.role === "user"
                              ? "bg-moss/10 border border-moss/20"
                              : "bg-neutral-50 border border-line"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span className="font-semibold">
                              {msg.role === "user" ? "User" : "Assistant"}
                            </span>
                            <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm">{msg.content}</p>
                          {msg.response_time_ms && (
                            <p className="mt-2 text-xs text-neutral-500">
                              Response time: {msg.response_time_ms}ms
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="text-sm text-neutral-500">
            Page {page} of {totalPages} • {total} total messages
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
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
