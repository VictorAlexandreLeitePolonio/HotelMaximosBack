import type { FastifyRequest } from "fastify";
import { verifyAccessToken } from "../../shared/auth/jwt.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthRepository, AuthUserRecord } from "./auth.service.js";

export async function getAuthenticatedUser(
  request: FastifyRequest,
  repository: AuthRepository
): Promise<AuthUserRecord> {
  const token = extractBearerToken(request.headers.authorization);

  try {
    const payload = verifyAccessToken(token);
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId)) {
      throw expiredSessionError();
    }

    const user = await repository.findActiveUserById(userId);

    if (!user) {
      throw expiredSessionError();
    }

    return user;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw expiredSessionError();
  }
}

export function assertAdminUser(user: AuthUserRecord): void {
  assertAllowedProfiles(user, ["Admin"]);
}

export function assertAllowedProfiles(
  user: AuthUserRecord,
  allowedProfiles: readonly AuthUserRecord["perfil"][]
): void {
  if (!allowedProfiles.includes(user.perfil)) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Acesso negado.",
      statusCode: 403
    });
  }
}

function extractBearerToken(authorization?: string): string {
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw expiredSessionError();
  }

  return token;
}

function expiredSessionError(): AppError {
  return new AppError({
    code: "AUTH_004",
    message: "Sessao expirada. Faca login novamente.",
    statusCode: 401
  });
}
