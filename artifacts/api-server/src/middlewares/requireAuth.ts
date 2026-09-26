import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
}

export function authClaims(req: Request): Record<string, unknown> {
  const auth = getAuth(req);
  return (auth.sessionClaims ?? {}) as unknown as Record<string, unknown>;
}