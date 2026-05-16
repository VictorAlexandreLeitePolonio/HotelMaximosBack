export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function isValidCpfFormat(cpf: string): boolean {
  return /^\d{11}$/.test(normalizeCpf(cpf));
}

export function normalizeRequiredText(value: string): string {
  return value.trim();
}

export function normalizeNullableText(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
