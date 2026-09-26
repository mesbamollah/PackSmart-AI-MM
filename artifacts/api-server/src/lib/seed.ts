import { db, commoditiesTable, materialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { commoditySeed, materialSeed } from "./catalogData";

export async function seedCatalog(): Promise<void> {
  for (const commodity of commoditySeed) {
    const [existing] = await db
      .select({ id: commoditiesTable.id })
      .from(commoditiesTable)
      .where(eq(commoditiesTable.id, commodity.id));
    if (!existing) {
      await db.insert(commoditiesTable).values(commodity);
    }
  }

  for (const material of materialSeed) {
    const [existing] = await db
      .select({ id: materialsTable.id })
      .from(materialsTable)
      .where(eq(materialsTable.id, material.id));
    if (!existing) {
      await db.insert(materialsTable).values({
        ...material,
        properties: JSON.stringify(material.properties),
      });
    }
  }
}