import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  perfil: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
