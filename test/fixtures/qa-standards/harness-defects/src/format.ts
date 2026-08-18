// Defect 6: formats currency and dates with an implicit locale and timezone,
// and no fixture policy pins either.
export function formatAmount(value: number): string {
  return value.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString();
}
