import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, recommendationsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(recommendationsTable)
    .where(eq(recommendationsTable.userId, userId))
    .orderBy(desc(recommendationsTable.createdAt));
  const materialCounts = new Map<string, number>();
  for (const row of rows) {
    materialCounts.set(row.materialName, (materialCounts.get(row.materialName) ?? 0) + 1);
  }
  const averageDays = rows.length
    ? rows.reduce((sum, row) => sum + Number.parseFloat(row.shelfLife), 0) / rows.length
    : 0;
  const latest = rows.slice(0, 5).map((row) => ({
    id: row.id,
    commodityName: row.commodityName,
    category: row.category,
    materialName: row.materialName,
    shelfLife: row.shelfLife,
    storageType: row.storageType,
    strength: row.strength,
    createdAt: row.createdAt,
  }));
  const summary = {
    totalRecommendations: rows.length,
    recentRecommendations: rows.filter((row) => Date.now() - row.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000).length,
    savedProducts: new Set(rows.map((row) => row.commodityName.toLowerCase())).size,
    averageShelfLife: rows.length ? `${Math.round(averageDays)} days` : "No saved data",
    topMaterials: [...materialCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([materialName, count]) => ({ materialName, count })),
    latest,
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;