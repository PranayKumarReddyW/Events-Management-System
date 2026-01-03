import {
  format,
  parseISO,
  formatDistance,
  formatRelative,
  isValid,
  isPast,
  isFuture,
} from "date-fns";

/**
 * Format a date string to a readable format
 */
export function formatDate(
  date: string | Date,
  formatStr: string = "MMM dd, yyyy"
): string {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(dateObj)) return "Invalid date";
    return format(dateObj, formatStr);
  } catch {
    return "Invalid date";
  }
}

/**
 * Format a date to relative time (e.g., "2 days ago")
 */
export function formatRelativeDate(date: string | Date): string {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(dateObj)) return "Invalid date";
    return formatDistance(dateObj, new Date(), { addSuffix: true });
  } catch {
    return "Invalid date";
  }
}

/**
 * Format a date to relative description (e.g., "today at 3:00 PM")
 */
export function formatRelativeDescription(date: string | Date): string {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(dateObj)) return "Invalid date";
    return formatRelative(dateObj, new Date());
  } catch {
    return "Invalid date";
  }
}

/**
 * Check if a date is in the past
 */
export function isDatePast(date: string | Date): boolean {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    return isPast(dateObj);
  } catch {
    return false;
  }
}

/**
 * Check if a date is in the future
 */
export function isDateFuture(date: string | Date): boolean {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    return isFuture(dateObj);
  } catch {
    return false;
  }
}

/**
 * Format duration in minutes to human readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get date range string (e.g., "Jan 1 - Jan 3, 2025")
 */
export function formatDateRange(
  startDate: string | Date,
  endDate: string | Date
): string {
  try {
    const start =
      typeof startDate === "string" ? parseISO(startDate) : startDate;
    const end = typeof endDate === "string" ? parseISO(endDate) : endDate;

    if (!isValid(start) || !isValid(end)) return "Invalid date range";

    const startFormatted = format(start, "MMM d");
    const endFormatted = format(end, "MMM d, yyyy");

    // If same month and year
    if (format(start, "MMM yyyy") === format(end, "MMM yyyy")) {
      return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
    }

    // If same year but different month
    if (format(start, "yyyy") === format(end, "yyyy")) {
      return `${startFormatted} - ${endFormatted}`;
    }

    // Different years
    return `${format(start, "MMM d, yyyy")} - ${endFormatted}`;
  } catch {
    return "Invalid date range";
  }
}

/**
 * Convert ISO date string to input datetime-local format
 */
export function toDateTimeLocal(date: string | Date): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (!isValid(dateObj)) return "";

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Get event status based on dates
 */
export function getEventStatus(
  startDate: string,
  endDate: string,
  status: string
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (status === "cancelled") {
    return { label: "Cancelled", variant: "destructive" };
  }

  if (status === "draft") {
    return { label: "Draft", variant: "outline" };
  }

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) {
    return { label: "Upcoming", variant: "default" };
  }

  if (now >= start && now <= end) {
    return { label: "Ongoing", variant: "secondary" };
  }

  return { label: "Completed", variant: "outline" };
}
