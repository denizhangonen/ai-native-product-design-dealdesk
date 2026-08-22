// Times are shown in Turkey time (UTC+3, no DST) with no zone label: the audience
// for this page lives there, and a label would only invite the question.
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

export function formatWhen(date: Date): string {
  return formatter.format(date);
}
