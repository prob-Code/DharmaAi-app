import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const AUTH_TIMEOUT_MS = 5000;

interface TokenValidationResult {
  ok: boolean;
  status: number;
}

/**
 * Validates a Supabase bearer access token against the existing Supabase auth
 * infrastructure (the Auth server's /auth/v1/user endpoint verifies the JWT
 * signature and expiry server-side). No service-role or private credential is
 * used — only the publishable anon key, exactly as the mobile client uses it.
 * Token validation is performed by Supabase, never locally.
 */
async function validateToken(
  token: string,
  timeoutMs: number = AUTH_TIMEOUT_MS
): Promise<TokenValidationResult> {
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { ok: false, status: 503 };
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    // Network/timeout talking to the auth service — a retryable service-side
    // failure, never a 2xx.
    return { ok: false, status: 504 };
  }
}

/**
 * Smallest safe authentication layer for protected routes: the authenticated
 * Supabase session's access token is presented as `Authorization: Bearer <token>`.
 *
 * Error contract (applied to the protected route):
 *  - missing/malformed/invalid/expired token -> 401
 *  - token valid for a disallowed account        -> 403 (reserved)
 *  - server auth validation not configured        -> 503
 *  - auth service timeout/unreachable             -> 504
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token =
      header && header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const result = await validateToken(token);

    if (result.status === 503) {
      res.status(503).json({ error: "Token validation is not configured on the server" });
      return;
    }
    if (result.status === 504) {
      res.status(504).json({ error: "Authentication service timed out. Please try again." });
      return;
    }
    if (result.status === 403) {
      res.status(403).json({ error: "This account is not allowed to use this route" });
      return;
    }
    if (!result.ok) {
      res.status(401).json({ error: "Missing, invalid, or expired token" });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}