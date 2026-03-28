import type { Response } from "express";
import type { ZodError, ZodSchema } from "zod";

export type ValidationIssue = { path: (string | number)[]; message: string };

export function formatZodIssues(err: ZodError): ValidationIssue[] {
  return err.issues.map((i) => ({
    path: i.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
    message: i.message
  }));
}

export function sendValidationError(res: Response, err: ZodError): void {
  res.status(400).json({
    error: "Dados inválidos.",
    code: "VALIDATION_ERROR",
    issues: formatZodIssues(err)
  });
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown, res: Response): T | null {
  const r = schema.safeParse(body);
  if (!r.success) {
    sendValidationError(res, r.error);
    return null;
  }
  return r.data;
}

export function parseParams<T>(schema: ZodSchema<T>, params: unknown, res: Response): T | null {
  const r = schema.safeParse(params);
  if (!r.success) {
    sendValidationError(res, r.error);
    return null;
  }
  return r.data;
}
