import type { MaterialProperties } from "./catalogData";
import type { MaterialRow } from "@workspace/db";

export type RecommendationInput = {
  commodityName: string;
  category: string;
  properties: {
    moistureContent: number;
    oilContent: number;
    ph: number;
    respirationRate: "low" | "medium" | "high" | "very-high";
    respirationNumeric?: number;
    oxygenSensitivity: "low" | "medium" | "high";
    lightSensitivity: "low" | "medium" | "high";
    microbialSensitivity: "low" | "medium" | "high";
    textureSensitivity: "low" | "medium" | "high";
  };
  storage: {
    shelfLifeValue: number;
    shelfLifeUnit: "days" | "weeks" | "months";
    storageType: "ambient" | "chilled" | "frozen";
    temperature: number;
    humidity: number;
    lightExposure: "low" | "medium" | "high";
  };
  transportation: {
    type: "local" | "regional" | "national" | "export";
    durationValue: number;
    durationUnit: "hours" | "days";
    mechanicalStress: "low" | "medium" | "high";
    temperatureFluctuation: "low" | "medium" | "high";
    humidityExposure: "low" | "medium" | "high";
    handlingConditions: "controlled" | "moderate" | "rough";
  };
  preferences: {
    priority: "shelf-life" | "cost" | "sustainability" | "balanced" | "protection";
    sustainability: "none" | "recyclable" | "biodegradable" | "compostable" | "strong";
    budget: "economy" | "standard" | "premium";
    mapRequired: "auto" | "yes" | "no";
    packageType: string;
  };
};

type MaterialView = {
  id: string;
  name: string;
  category: string;
  polymerFamily: string;
  barrierSummary: string;
  sustainability: string;
  cost: "low" | "medium" | "high";
  mapSuitability: "recommended" | "conditional" | "not-recommended";
  properties: MaterialProperties;
  applications: string[];
  advantages: string[];
  limitations: string[];
  compatibilityNotes: string[];
  thicknessRange: string;
  recyclability: string;
  biodegradability: string;
  compostability: string;
};

const level: Record<string, number> = { low: 1, medium: 2, high: 3, "very-high": 4 };
const costRank: Record<string, number> = { low: 1, medium: 2, high: 3 };

export function materialFromRow(row: MaterialRow): MaterialView {
  const properties = JSON.parse(row.properties) as MaterialProperties;
  return {
    ...row,
    properties,
    cost: row.cost as MaterialView["cost"],
    mapSuitability: row.mapSuitability as MaterialView["mapSuitability"],
  };
}

function shelfLifeDays(input: RecommendationInput): number {
  const multiplier = { days: 1, weeks: 7, months: 30 }[input.storage.shelfLifeUnit];
  return input.storage.shelfLifeValue * multiplier;
}

function isFreshProduce(input: RecommendationInput): boolean {
  return ["fruits", "vegetables"].includes(input.category.toLowerCase());
}

function scoreMaterial(material: MaterialView, input: RecommendationInput): number {
  const shelfDays = shelfLifeDays(input);
  const highBarrierNeed =
    level[input.properties.oxygenSensitivity] +
    level[input.properties.lightSensitivity] +
    (shelfDays >= 90 ? 1 : 0) +
    (input.properties.oilContent >= 10 ? 1 : 0);
  const moistureNeed =
    level[input.properties.microbialSensitivity] +
    (input.properties.moistureContent >= 20 ? 1 : 0) +
    (input.storage.humidity >= 70 ? 1 : 0);
  const strengthNeed =
    level[input.transportation.mechanicalStress] +
    level[input.transportation.handlingConditions === "rough" ? "high" : input.transportation.handlingConditions === "moderate" ? "medium" : "low"];

  const fresh = isFreshProduce(input);
  const barrierScore = (material.properties.oxygenRating / 5) * Math.min(highBarrierNeed / 6, 1);
  const moistureScore = (material.properties.moistureRating / 5) * Math.min(moistureNeed / 5, 1);
  const lightScore = (material.properties.lightRating / 5) * (level[input.properties.lightSensitivity] / 3);
  const strengthScore = (material.properties.strengthRating / 5) * Math.min(strengthNeed / 6, 1);
  const tempScore =
    input.storage.storageType === "frozen"
      ? material.properties.temperatureSuitability.toLowerCase().includes("frozen") ? 1 : 0.6
      : 1;
  const sustainabilityScore =
    input.preferences.sustainability === "strong" || input.preferences.priority === "sustainability"
      ? material.properties.sustainabilityRating / 5
      : 0.55 + material.properties.sustainabilityRating / 10;
  const costScore =
    input.preferences.budget === "economy" || input.preferences.priority === "cost"
      ? material.properties.costRating / 5
      : 0.55 + material.properties.costRating / 10;
  const produceScore = fresh ? (material.properties.breathable ? 1 : 0.25) : material.properties.breathable ? 0.7 : 1;
  const mapScore =
    input.preferences.mapRequired === "yes"
      ? material.mapSuitability === "recommended" ? 1 : material.mapSuitability === "conditional" ? 0.65 : 0.2
      : 1;

  const priorityWeights = {
    "shelf-life": [0.3, 0.2, 0.15, 0.12, 0.08, 0.05, 0.05, 0.05],
    cost: [0.15, 0.15, 0.1, 0.1, 0.08, 0.08, 0.24, 0.1],
    sustainability: [0.15, 0.15, 0.1, 0.1, 0.08, 0.24, 0.08, 0.1],
    balanced: [0.2, 0.17, 0.12, 0.12, 0.1, 0.08, 0.1, 0.11],
    protection: [0.26, 0.22, 0.14, 0.14, 0.1, 0.04, 0.04, 0.11],
  } as const;
  const weights = priorityWeights[input.preferences.priority];
  const values = [barrierScore, moistureScore, lightScore, strengthScore, tempScore, sustainabilityScore, costScore, produceScore * mapScore];
  const weighted = values.reduce((sum, value, index) => sum + value * weights[index], 0);
  return Math.round(Math.max(0, Math.min(100, weighted * 100)));
}

export function materialSummary(material: MaterialView) {
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
}

function shelfLifeLabel(input: RecommendationInput): string {
  return `${input.storage.shelfLifeValue} ${input.storage.shelfLifeUnit}`;
}

function otrRequirement(input: RecommendationInput, material: MaterialView): string {
  const fresh = isFreshProduce(input);
  const target = fresh
    ? `Controlled OTR / CO₂ exchange for ${input.properties.respirationRate} respiration`
    : level[input.properties.oxygenSensitivity] >= 3
      ? "Low OTR profile for oxygen-sensitive food"
      : "Moderate OTR profile for the entered oxygen sensitivity";
  return `${target}; catalog capability: ${material.properties.oxygenBarrier} oxygen barrier`;
}

function wvtrRequirement(input: RecommendationInput, material: MaterialView): string {
  const highMoistureDemand = level[input.properties.microbialSensitivity] >= 3 || input.properties.moistureContent >= 20 || input.storage.humidity >= 70;
  const target = highMoistureDemand ? "Low WVTR / strong moisture control" : "Moderate WVTR / balanced moisture control";
  return `${target} at ${input.storage.humidity}% RH; catalog capability: ${material.properties.moistureBarrier} moisture barrier`;
}

function gasPermeabilityRequirement(input: RecommendationInput, material: MaterialView): string {
  return isFreshProduce(input)
    ? `Controlled O₂ / CO₂ exchange for ${input.properties.respirationRate} respiration; catalog: ${material.properties.gasPermeability}`
    : material.properties.gasPermeability;
}

function mechanicalRequirement(input: RecommendationInput, material: MaterialView): string {
  const handlingDemand = input.transportation.handlingConditions === "rough" ? "high" : input.transportation.handlingConditions;
  return `${material.properties.mechanicalStrength}; ${handlingDemand} handling / ${input.transportation.mechanicalStress} transport stress`;
}

export function buildRecommendation(input: RecommendationInput, rows: MaterialRow[]) {
  const materials = rows.map(materialFromRow);
  const ranked = materials
    .map((material) => ({ material, score: scoreMaterial(material, input) }))
    .sort((a, b) => b.score - a.score);
  const primary = ranked[0];
  const cost = [...ranked].sort((a, b) => {
    const costDelta = costRank[a.material.cost] - costRank[b.material.cost];
    return costDelta || b.score - a.score;
  }).find((candidate) => candidate.material.id !== primary.material.id) ?? ranked[1];
  const sustainable = [...ranked].sort((a, b) => {
    const sustainabilityDelta = b.material.properties.sustainabilityRating - a.material.properties.sustainabilityRating;
    return sustainabilityDelta || b.score - a.score;
  }).find((candidate) => candidate.material.id !== primary.material.id && candidate.material.id !== cost.material.id) ?? ranked[2];

  const fresh = isFreshProduce(input);
  const strongMatch = primary.score >= 78;
  const goodMatch = primary.score >= 62;
  const reasons = [
    `The engine prioritized ${input.properties.oxygenSensitivity} oxygen protection, ${input.properties.microbialSensitivity} microbial control, and a ${shelfLifeLabel(input)} target.`,
    `${primary.material.name} matches the entered ${input.category.toLowerCase()} handling and storage profile.`,
    fresh
      ? "Fresh-produce logic favors controlled gas exchange over an impermeable high-barrier structure."
      : "The selected structure supports the requested barrier and handling requirements without claiming a trained ML prediction.",
  ];
  const matchedRequirements = [
    `${primary.material.properties.moistureBarrier} moisture barrier`,
    `${primary.material.properties.oxygenBarrier} oxygen barrier`,
    `${primary.material.properties.mechanicalStrength} mechanical strength`,
    `${primary.material.properties.sealability} sealability`,
  ];
  const weakRequirements = [
    primary.material.properties.lightRating < level[input.properties.lightSensitivity] ? "Light protection may be below the requested sensitivity level" : "",
    primary.material.properties.moistureRating < level[input.properties.microbialSensitivity] ? "Moisture protection needs validation for the entered humidity" : "",
    fresh && !primary.material.properties.breathable ? "Gas exchange may need a perforated or breathable inner component" : "",
  ].filter(Boolean);
  const warnings = [
    "This recommendation is based on the available material-property database and should be validated experimentally.",
    "Commercial selection should include food-contact, regulatory, seal-integrity, and shelf-life testing.",
    ...(fresh && input.properties.respirationRate === "very-high" ? ["Very high respiration makes commodity-specific gas-exchange validation especially important."] : []),
    ...(shelfLifeDays(input) > 180 && input.storage.storageType === "ambient" ? ["The target shelf life is unusually long for ambient storage; validate with a study."] : []),
  ];
  const structure = fresh
    ? `${primary.material.name} with controlled-breathability film structure`
    : `${primary.material.name} with a ${input.preferences.packageType.toLowerCase()} sealant structure`;
  const mapSuitability = input.preferences.mapRequired === "no"
    ? "not-recommended"
    : primary.material.mapSuitability;

  return {
    engineVersion: "rule-engine-1.0",
    recommendation: {
      ...primary.material,
      properties: primary.material.properties,
    },
    score: primary.score,
    strength: (strongMatch ? "strong" : goodMatch ? "good" : primary.score >= 45 ? "conditional" : "insufficient") as "strong" | "good" | "conditional" | "insufficient",
    reasons,
    matchedRequirements,
    weakRequirements,
    specifications: {
      structure,
      thickness: primary.material.thicknessRange,
      otr: otrRequirement(input, primary.material),
      wvtr: wvtrRequirement(input, primary.material),
      sealability: primary.material.properties.sealability,
      mechanicalStrength: mechanicalRequirement(input, primary.material),
      gasPermeability: gasPermeabilityRequirement(input, primary.material),
      mapSuitability,
    },
    alternatives: [
      {
        role: "cost-conscious",
        material: materialSummary(cost.material),
        score: cost.score,
        tradeoff: `${cost.material.name} may reduce relative packaging cost, but its ${cost.material.barrierSummary.toLowerCase()} may require a shorter target, stronger secondary protection, or additional validation.`,
      },
      {
        role: "sustainable",
        material: materialSummary(sustainable.material),
        score: sustainable.score,
        tradeoff: `${sustainable.material.name} offers a more favorable sustainability profile, while barrier, supply, and local waste-management trade-offs should be checked.`,
      },
    ],
    warnings,
    explanation: `Because the product has ${input.properties.oxygenSensitivity} oxygen sensitivity and a ${shelfLifeLabel(input)} target, the data-driven engine prioritized packaging with ${primary.material.properties.oxygenBarrier.toLowerCase()} oxygen protection and ${primary.material.properties.moistureBarrier.toLowerCase()} moisture protection. The result is an indicative decision-support output, not a trained machine-learning prediction.`,
    shelfLifeSupport: {
      assessment: strongMatch ? "Strong support for the target based on available material-property data" : goodMatch ? "Good support for the target with validation required" : "Conditional support; testing is needed before relying on the target",
      target: shelfLifeLabel(input),
      risks: [
        input.properties.oxygenSensitivity === "high" ? "Oxidation and flavor changes" : "Oxidation under extended storage",
        input.storage.humidity >= 70 ? "Moisture uptake and texture change" : "Humidity variation during storage",
        input.transportation.mechanicalStress === "high" ? "Seal or pack damage during handling" : "Handling and distribution stress",
      ],
      controls: ["Validate seal integrity", "Run accelerated and real-time shelf-life studies", "Confirm storage and transport temperature control"],
    },
    sustainability: {
      recyclability: primary.material.recyclability,
      biodegradability: primary.material.biodegradability,
      compostability: primary.material.compostability,
      tradeoff: primary.material.sustainability,
    },
  };
}