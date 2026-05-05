"use client";

import { useState } from "react";
import type { CalendarSlot } from "@/lib/agent/calendar";
import { Calendar, Clock, CheckCircle, Loader2, ArrowRight } from "lucide-react";

type Props = {
  slots: CalendarSlot[];
  onBooked?: (slot: CalendarSlot, name: string, email: string) => void;
  prefillName?: string;
  prefillEmail?: string;
};

export function BookingPanel({ slots, onBooked, prefillName = "", prefillEmail = "" }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [name, setName] = useState(prefillName);
  const [email, setEmail] = useState(prefillEmail);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleBook() {
    if (!selectedSlot || !name.trim() || !email.trim()) return;
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/agent/book-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          slotId: selectedSlot.id,
          slotIso: selectedSlot.isoDateTime,
          displayDate: selectedSlot.displayDate,
          displayTime: selectedSlot.displayTime,
          notes: notes.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Booking failed");
      }

      setState("success");
      onBooked?.(selectedSlot, name, email);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
        <p className="font-semibold text-emerald-800 text-base">Meeting booked!</p>
        <p className="text-sm text-emerald-700 mt-1">
          {selectedSlot?.displayDate} at {selectedSlot?.displayTime}
        </p>
        <p className="text-xs text-emerald-600 mt-2">A confirmation email is on its way to {email}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-neutral-500" />
        <span className="font-semibold text-neutral-800 text-sm">Book a Strategy Call</span>
      </div>

      {/* Slot grid */}
      <div className="space-y-2">
        {slots.slice(0, 6).map((slot) => (
          <button
            key={slot.id}
            onClick={() => setSelectedSlot(slot)}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all ${
              selectedSlot?.id === slot.id
                ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                : "border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50"
            }`}
          >
            <span className="font-medium">{slot.displayDate}</span>
            <span className="flex items-center gap-1 text-neutral-500">
              <Clock className="h-3 w-3" />
              {slot.displayTime}
            </span>
          </button>
        ))}
      </div>

      {/* Contact fields */}
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any specific topics? (optional)"
          rows={2}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm resize-none focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {state === "error" && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}

      <button
        onClick={handleBook}
        disabled={!selectedSlot || !name.trim() || !email.trim() || state === "loading"}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Confirm Booking <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}
