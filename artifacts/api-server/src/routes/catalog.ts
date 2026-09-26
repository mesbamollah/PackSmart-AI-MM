import { and, asc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, commoditiesTable, materialsTable } from "@workspace/db";
import {
  GetMaterialParams,
  GetMaterialResponse,
  ListCommoditiesResponse,
  ListMaterialsQueryParams,
  ListMaterialsResponse,
} from "@workspace/api-zod";
import { materialFromRow } from "../lib/recommendationEngine";

const router: IRouter = Router();

router.get("/commodities", async (_req, res): Promise<void> => {
  const rows = await db.select().from(commoditiesTable).orderBy(asc(commoditiesTable.name));
  res.json(ListCommoditiesResponse.parse(rows));
});

router.get("/materials", async (req, res): Promise<void> => {
  const parsed = ListMaterialsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, category, sustainability, cost } = parsed.data;
  const filters = [
    search ? ilike(materialsTable.name, `%${search}%`) : undefined,
    category ? eq(materialsTable.category, category) : undefined,
    sustainability ? ilike(materialsTable.sustainability, `%${sustainability}%`) : undefined,
    cost ? eq(materialsTable.cost, cost) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select()
    .from(materialsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(materialsTable.name));
  res.json(ListMaterialsResponse.parse(rows.map((row) => {
    const material = materialFromRow(row);
    return {
      id: material.id,
      name: material.name,
      category: material.category,
      polymerFamily: material.polymerFamily,
      barrierSummary: material.barrierSummary,
      sustainability: material.sustainability,
      cost: material.cost,
      mapSuitability: material.mapSuitability,
    };
  })));
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  const params = GetMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(materialsTable).where(eq(materialsTable.id, String(params.data.id)));
  if (!row) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  const material = materialFromRow(row);
  res.json(GetMaterialResponse.parse(material));
});

export default router;