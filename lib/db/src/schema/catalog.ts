import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const commoditiesTable = pgTable("commodities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  moistureRange: text("moisture_range").notNull(),
  typicalPhRange: text("typical_ph_range").notNull(),
  respirationClass: text("respiration_class").notNull(),
  oxygenSensitivity: text("oxygen_sensitivity").notNull(),
  moistureSensitivity: text("moisture_sensitivity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const materialsTable = pgTable("materials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  polymerFamily: text("polymer_family").notNull(),
  barrierSummary: text("barrier_summary").notNull(),
  sustainability: text("sustainability").notNull(),
  cost: text("cost").notNull(),
  mapSuitability: text("map_suitability").notNull(),
  properties: text("properties").notNull(),
  applications: text("applications").array().notNull(),
  advantages: text("advantages").array().notNull(),
  limitations: text("limitations").array().notNull(),
  compatibilityNotes: text("compatibility_notes").array().notNull(),
  thicknessRange: text("thickness_range").notNull(),
  recyclability: text("recyclability").notNull(),
  biodegradability: text("biodegradability").notNull(),
  compostability: text("compostability").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Commodity = typeof commoditiesTable.$inferSelect;
export type MaterialRow = typeof materialsTable.$inferSelect;