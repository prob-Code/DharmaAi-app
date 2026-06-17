import { NextFunction, Request, Response } from "express";
import { ApiError } from "../types/api";

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode ?? 500;
  const message = statusCode >= 500 ? "Internal server error" : err.message;

  res.status(statusCode).json({
    error: message,
    details: err.details ?? null
  });
}
