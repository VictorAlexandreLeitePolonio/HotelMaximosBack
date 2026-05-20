import type { MultipartFile } from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

type ResolveComprovanteInput = {
  comprovante?: string;
  comprovanteArquivo?: MultipartFile;
};

export async function resolveComprovanteValue(
  input: ResolveComprovanteInput
): Promise<string | undefined> {
  if (input.comprovanteArquivo) {
    return saveUploadedComprovante(input.comprovanteArquivo);
  }

  return input.comprovante?.trim() ? input.comprovante.trim() : undefined;
}

async function saveUploadedComprovante(file: MultipartFile): Promise<string> {
  const buffer = await file.toBuffer();

  if (!buffer.length) {
    throw invalidComprovanteFileError();
  }

  if (file.file.truncated) {
    throw comprovanteTooLargeError();
  }

  const directory = path.resolve(process.cwd(), env.UPLOADS_DIR, "comprovantes");
  const extension = path.extname(file.filename ?? "").slice(0, 20);
  const storageName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}${extension}`;

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storageName), buffer);

  return path.posix.join(env.UPLOADS_DIR, "comprovantes", storageName);
}

function invalidComprovanteFileError() {
  return new AppError({
    code: "UPLOAD_001",
    message: "O comprovante enviado está vazio.",
    statusCode: 400
  });
}

export function comprovanteTooLargeError() {
  return new AppError({
    code: "UPLOAD_002",
    message: "O comprovante excede o limite máximo permitido.",
    statusCode: 413,
    details: {
      maxBytes: env.COMPROVANTE_MAX_FILE_SIZE_BYTES
    }
  });
}
