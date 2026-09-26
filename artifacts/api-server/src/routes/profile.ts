import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, profilesTable } from "@workspace/db";
import { GetProfileResponse, UpdateProfileBody, UpdateProfileResponse } from "@workspace/api-zod";
import { authClaims, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function ensureProfile(userId: string, claims: Record<string, unknown>) {
  const [existing] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (existing) return existing;
  const firstName = typeof claims.firstName === "string" ? claims.firstName : "";
  const lastName = typeof claims.lastName === "string" ? claims.lastName : "";
  const nameClaim = typeof claims.name === "string" ? claims.name : "";
  const emailClaim = typeof claims.email === "string" ? claims.email : "";
  const name = nameClaim || `${firstName} ${lastName}`.trim() || "PackSmart member";
  const email = emailClaim || `member-${userId.slice(-8)}@packsmart.local`;
  const [created] = await db.insert(profilesTable).values({ id: userId, name, email }).returning();
  return created;
}

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const profile = await ensureProfile(res.locals.userId as string, authClaims(req));
  res.json(GetProfileResponse.parse(profile));
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const profile = await ensureProfile(userId, authClaims(req));
  const [updated] = await db
    .update(profilesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(profilesTable.id, profile.id))
    .returning();
  res.json(UpdateProfileResponse.parse(updated));
});

export default router;