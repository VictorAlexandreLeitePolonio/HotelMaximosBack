import type { MultipartFile, MultipartValue } from "@fastify/multipart";
import { z } from "zod";

function isMultipartValue(value: unknown): value is MultipartValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "field" &&
    "value" in value
  );
}

export function isMultipartFile(value: unknown): value is MultipartFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type?: unknown }).type === "file" &&
    "toBuffer" in value
  );
}

export function unwrapMultipartValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => unwrapMultipartValue(item));
  }

  if (isMultipartValue(value)) {
    return value.value;
  }

  return value;
}

export function multipartStringField<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.preprocess(unwrapMultipartValue, schema);
}

export function multipartNumberField<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.preprocess(unwrapMultipartValue, schema);
}

export function multipartDateField<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return z.preprocess(unwrapMultipartValue, schema);
}

export function multipartBooleanField(defaultValue = false) {
  return z.preprocess((value) => {
    const raw = unwrapMultipartValue(value);

    if (raw === undefined || raw === null || raw === "") {
      return defaultValue;
    }

    if (typeof raw === "boolean") {
      return raw;
    }

    if (typeof raw === "string") {
      const normalized = raw.trim().toLowerCase();

      if (["true", "1", "sim", "yes"].includes(normalized)) {
        return true;
      }

      if (["false", "0", "nao", "não", "no"].includes(normalized)) {
        return false;
      }
    }

    return raw;
  }, z.boolean());
}

export function multipartNumberArrayField() {
  return z.preprocess((value) => {
    const raw = unwrapMultipartValue(value);

    if (raw === undefined || raw === null || raw === "") {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw;
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();

      if (!trimmed) {
        return [];
      }

      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      }
    }

    return raw;
  }, z.array(z.coerce.number().int().positive()).default([]));
}

export const optionalMultipartFileSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value;
}, z.custom<MultipartFile>((value) => value === undefined || isMultipartFile(value)).optional());
