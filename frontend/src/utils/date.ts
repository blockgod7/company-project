export function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}
