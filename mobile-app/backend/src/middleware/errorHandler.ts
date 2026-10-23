import { NextFunction, Request, Response } from "express";
import { ApiError } from "../types/api";

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  console.error("API request failed:", {
    path: _req.path,
    method: _req.method,
    message: err.message,
    code: (err as ApiError & { code?: string }).code
  });

  const statusCode = err.statusCode ?? 500;
  const errorCode = (err as ApiError & { code?: string }).code;
  const isSupabaseSetupError = errorCode === "42P01"
    || errorCode === "PGRST205"
    || err.message.includes("Supabase social store is not configured");
  const isSocialRequest = _req.path.startsWith("/social");
  const message = isSupabaseSetupError
    ? "Social data storage is not configured. Run SUPABASE_SOCIAL_BRIDGE.sql and verify the backend Supabase variables."
    : statusCode >= 500 ? "Internal server error" : err.message;
  const details = isSupabaseSetupError || isSocialRequest
    ? (typeof err.message === "string" ? err.message : null)
    : err.details ?? null;

  res.status(isSupabaseSetupError ? 503 : statusCode).json({
    error: message,
    details
  });
}
