import "server-only";

export type CalendarSlot = {
  id: string;
  date: string;        // "2026-05-08"
  time: string;        // "14:00"
  displayDate: string; // "Thursday, 8 May 2026"
  displayTime: string; // "2:00 PM"
  isoDateTime: string; // ISO 8601
};

// Preferred meeting times in 24h
const SLOT_TIMES = [
  { time: "10:00", label: "10:00 AM" },
  { time: "14:00", label: "2:00 PM" },
  { time: "16:00", label: "4:00 PM" }
];

function nextBusinessDays(count: number, startFrom?: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(startFrom ?? Date.now());
  cursor.setDate(cursor.getDate() + 1); // Start from tomorrow
  cursor.setHours(0, 0, 0, 0);

  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function buildMockSlots(): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  const days = nextBusinessDays(5);

  for (const day of days) {
    for (const { time, label } of SLOT_TIMES) {
      const [h, m] = time.split(":").map(Number);
      const dt = new Date(day);
      dt.setHours(h, m, 0, 0);

      slots.push({
        id: `${day.toISOString().split("T")[0]}-${time}`,
        date: day.toISOString().split("T")[0],
        time,
        displayDate: day.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }),
        displayTime: label,
        isoDateTime: dt.toISOString()
      });
    }
  }
  return slots;
}

async function getGoogleCalendarSlots(
  accessToken: string,
  calendarId: string
): Promise<CalendarSlot[]> {
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks ahead

  const freeBusyResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }]
      }),
      signal: AbortSignal.timeout(8_000)
    }
  );

  if (!freeBusyResponse.ok) {
    console.warn("[Calendar] freeBusy API failed, falling back to mock slots");
    return buildMockSlots();
  }

  const freeBusy = await freeBusyResponse.json();
  const busy: Array<{ start: string; end: string }> =
    freeBusy.calendars?.[calendarId]?.busy ?? [];

  const allSlots = buildMockSlots();
  return allSlots.filter((slot) => {
    const slotStart = new Date(slot.isoDateTime).getTime();
    const slotEnd = slotStart + 60 * 60 * 1000; // 1-hour meeting
    return !busy.some((b) => {
      const busyStart = new Date(b.start).getTime();
      const busyEnd = new Date(b.end).getTime();
      return slotStart < busyEnd && slotEnd > busyStart;
    });
  });
}

export async function getAvailableSlots(maxSlots = 9): Promise<CalendarSlot[]> {
  const accessToken = process.env.GOOGLE_CALENDAR_TOKEN;
  const calendarId =
    process.env.GOOGLE_CALENDAR_ID ?? "primary";

  try {
    const slots = accessToken
      ? await getGoogleCalendarSlots(accessToken, calendarId)
      : buildMockSlots();
    return slots.slice(0, maxSlots);
  } catch {
    return buildMockSlots().slice(0, maxSlots);
  }
}

export function formatSlotsForAgent(slots: CalendarSlot[]): string {
  if (!slots.length) return "No available slots found.";
  return slots
    .slice(0, 3)
    .map((s) => `• ${s.displayDate} at ${s.displayTime}`)
    .join("\n");
}
