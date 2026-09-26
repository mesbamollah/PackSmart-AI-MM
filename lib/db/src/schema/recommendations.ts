import { pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

export const recommendationsTable = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  commodityName: text("commodity_name").notNull(),
  category: text("category").notNull(),
  materialId: text("material_id").notNull(),
  materialName: text("material_name").notNull(),
  storageType: text("storage_type").notNull(),
  shelfLife: text("shelf_life").notNull(),
  score: real("score").notNull(),
  strength: text("strength").notNull(),
  input: text("input").notNull(),
  result: text("result").notNull(),
  shareId: text("share_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecommendationRow = typeof recommendationsTable.$inferSelect;