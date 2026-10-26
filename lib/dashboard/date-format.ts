const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Keep SSR and browser text identical even when their ICU date patterns differ. */
export function displayTime(value: string, timeZone = "UTC", full = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(full ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const } : {}),
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const day = `${Number(get("day"))} ${months[Number(get("month")) - 1]}`;
  return full ? `${day} ${get("year")}, ${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}` : day;
}
