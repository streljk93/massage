/** UTC instant из ISO → `YYYYMMDDTHHMMSSZ` (iCalendar). */
function isoToIcsUtcTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("Invalid date");
  }
  return d
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");
}

/** Экранирование TEXT в iCalendar (RFC 5545). */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export type BookingIcsEventInput = {
  uid: string;
  startsAtIso: string;
  endsAtIso: string;
  summary: string;
  description?: string;
};

export function buildBookingIcsDocument(input: BookingIcsEventInput): string {
  const dtStamp = isoToIcsUtcTimestamp(new Date().toISOString());
  const dtStart = isoToIcsUtcTimestamp(input.startsAtIso);
  const dtEnd = isoToIcsUtcTimestamp(input.endsAtIso);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Services App//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
  ];
  if (input.description != null && input.description !== "") {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  queueMicrotask(() => {
    URL.revokeObjectURL(url);
  });
}

export type ShareOrDownloadIcsResult = "share" | "download" | "cancelled";

/**
 * Системный календарь: где поддерживается — `navigator.share` с `.ics`;
 * иначе скачивание файла (ОС предложит открыть в календаре).
 */
export async function shareOrDownloadIcs(
  icsBody: string,
  filename: string,
): Promise<ShareOrDownloadIcsResult> {
  const blob = new Blob([icsBody], {
    type: "text/calendar;charset=utf-8",
  });
  const file = new File([blob], filename, {
    type: "text/calendar;charset=utf-8",
  });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return "share";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return "cancelled";
      }
      if (e instanceof Error && e.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  triggerBlobDownload(blob, filename);
  return "download";
}
