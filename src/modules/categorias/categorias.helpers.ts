export function normalizeRequiredText(value: string): string {
  return value.trim();
}

export function normalizeName(value: string): string {
  return normalizeRequiredText(value).toLocaleLowerCase();
}
