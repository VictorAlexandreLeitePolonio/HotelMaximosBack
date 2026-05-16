export function normalizeRequiredText(value: string): string {
  return value.trim();
}

export function normalizeFlatNumber(value: string): string {
  return normalizeRequiredText(value).toLocaleUpperCase();
}
