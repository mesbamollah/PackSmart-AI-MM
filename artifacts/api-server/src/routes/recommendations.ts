import crypto from "node:crypto";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, materialsTable, recommendationsTable } from "@workspace/db";
import {
  AnalyzeRecommendationBody,
  AnalyzeRecommendationResponse,
  CreateRecommendationShareParams,
  CreateRecommendationShareResponse,
  GetPublicRecommendationParams,
  GetPublicRecommendationResponse,
  GetRecommendationParams,
  GetRecommendationResponse,
  ListRecommendationsQueryParams,
  ListRecommendationsResponse,
  SaveRecommendationBody,
  SaveRecommendationResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildRecommendation, type RecommendationInput } from "../lib/recommendationEngine";

const router: IRouter = Router();

function shelfLifeLabel(input: RecommendationInput): string {
  return `${input.storage.shelfLifeValue} ${input.storage.shelfLifeUnit}`;
}

function serializeSaved(row: typeof recommendationsTable.$inferSelect) {
  return {
    id: row.id,
    commodityName: row.commodityName,
    category: row.category,
    storageType: row.storageType,
    shelfLife: row.shelfLife,
    createdAt: row.createdAt,
    shareId: row.shareId,
    input: JSON.parse(row.input),
    result: JSON.parse(row.result),
  };
}

router.post("/recommendations/analyze", requireAuth, async (req, res): Promise<void> => {
  const parsed = AnalyzeRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(materialsTable);
  const result = buildRecommendation(parsed.data as RecommendationInput, rows);
  res.json(AnalyzeRecommendationResponse.parse(result));
});

router.get("/recommendations", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListRecommendationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, commodity, storageType, sort } = parsed.data;
  const filters = [
    eq(recommendationsTable.userId, res.locals.userId as string),
    search ? ilike(recommendationsTable.commodityName, `%${search}%`) : undefined,
    commodity ? eq(recommendationsTable.commodityName, commodity) : undefined,
    storageType ? eq(recommendationsTable.storageType, storageType) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(recommendationsTable)
    .where(and(...filters))
    .orderBy(sort === "oldest" ? asc(recommendationsTable.createdAt) : sort === "shelfLife" ? desc(recommendationsTable.score) : desc(recommendationsTable.createdAt));
  res.json(ListRecommendationsResponse.parse(rows.map((row) => ({
    id: row.id,
    commodityName: row.commodityName,
    category: row.category,
    materialName: row.materialName,
    shelfLife: row.shelfLife,
    storageType: row.storageType,
    strength: row.strength,
    createdAt: row.createdAt,
  }))));
});

router.post("/recommendations", requireAuth, async (req, res): Promise<void> => {
  const parsed = SaveRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data.input as RecommendationInput;
  const result = parsed.data.result;
  const [created] = await db.insert(recommendationsTable).values({
    userId: res.locals.userId as string,
    commodityName: input.commodityName,
    category: input.category,
    materialId: result.recommendation.id,
    materialName: result.recommendation.name,
    storageType: input.storage.storageType,
    shelfLife: shelfLifeLabel(input),
    score: result.score,
    strength: result.strength,
    input: JSON.stringify(input),
    result: JSON.stringify(result),
  }).returning();
  res.status(201).json(SaveRecommendationResponse.parse(serializeSaved(created)));
});

router.get("/recommendations/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecommendationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(recommendationsTable).where(and(
    eq(recommendationsTable.id, params.data.id),
    eq(recommendationsTable.userId, res.locals.userId as string),
  ));
  if (!row) {
    res.status(404).json({ error: "Recommendation not found" });
    return;
  }
  res.json(GetRecommendationResponse.parse(serializeSaved(row)));
});

router.post("/recommendations/:id/share", requireAuth, async (req, res): Promise<void> => {
  const params = CreateRecommendationShareParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(recommendationsTable).where(and(
    eq(recommendationsTable.id, params.data.id),
    eq(recommendationsTable.userId, res.locals.userId as string),
  ));
  if (!row) {
    res.status(404).json({ error: "Recommendation not found" });
    return;
  }
  const shareId = row.shareId ?? crypto.randomUUID().replaceAll("-", "");
  await db.update(recommendationsTable).set({ shareId }).where(eq(recommendationsTable.id, row.id));
  const url = `${req.protocol}://${req.get("host")}/public/recommendation/${shareId}`;
  res.json(CreateRecommendationShareResponse.parse({ shareId, url }));
});

router.get("/recommendations/public/:shareId", async (req, res): Promise<void> => {
  const params = GetPublicRecommendationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(recommendationsTable).where(eq(recommendationsTable.shareId, params.data.shareId));
  if (!row || !row.shareId) {
    res.status(404).json({ error: "Shared recommendation not found" });
    return;
  }
  const result = JSON.parse(row.result) as { specifications: { structure: string; thickness: string }; score: number; strength: string; explanation: string; warnings: string[] };
  res.json(GetPublicRecommendationResponse.parse({
    shareId: row.shareId,
    commodityName: row.commodityName,
    category: row.category,
    materialName: row.materialName,
    structure: result.specifications.structure,
    thickness: result.specifications.thickness,
    score: result.score,
    strength: result.strength,
    explanation: result.explanation,
    warnings: result.warnings,
    createdAt: row.createdAt,
  }));
});

export default router;