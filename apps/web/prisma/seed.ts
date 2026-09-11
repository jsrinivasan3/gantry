import { readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

import { prisma } from "../src/server/db/client";

const SAMPLE_DATA_DIR = path.resolve(__dirname, "../../../sample-data");

function parseCsv(filePath: string): Record<string, string>[] {
  const raw = readFileSync(filePath, "utf-8").trim();
  const [headerLine, ...lines] = raw.split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}

async function seedUsers() {
  const users = [
    { email: "admin@gantry.local", displayName: "Ada Admin", role: "ADMIN" as const, password: "admin1234" },
    { email: "planner@gantry.local", displayName: "Pat Planner", role: "PLANNER" as const, password: "planner1234" },
    { email: "viewer@gantry.local", displayName: "Val Viewer", role: "VIEWER" as const, password: "viewer1234" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        passwordHash,
      },
    });
  }
  console.log(`Seeded ${users.length} users (dev credentials in docs/MILESTONES.md / README).`);
}

async function seedTeams() {
  const rows = parseCsv(path.join(SAMPLE_DATA_DIR, "teams.csv"));
  for (const row of rows) {
    const data = { name: row.name, hourlyRate: row.hourly_rate, active: row.active === "true" };
    const existing = await prisma.team.findFirst({ where: { name: row.name } });
    const team = existing
      ? await prisma.team.update({ where: { id: existing.id }, data })
      : await prisma.team.create({ data });

    await prisma.capacityEntry.deleteMany({ where: { teamId: team.id, scenarioId: null } });
    await prisma.capacityEntry.create({
      data: {
        teamId: team.id,
        scenarioId: null,
        effectiveDate: new Date(),
        headcount: Number(row.headcount),
        hoursPerPerson: row.hours_per_person,
      },
    });
  }
  console.log(`Seeded ${rows.length} teams + capacity entries.`);
}

async function seedParts() {
  const rows = parseCsv(path.join(SAMPLE_DATA_DIR, "parts.csv"));
  for (const row of rows) {
    await prisma.part.upsert({
      where: { sku: row.sku },
      update: {
        name: row.name,
        unitCost: row.unit_cost,
        onHandCount: Number(row.on_hand_count),
        reorderPoint: Number(row.reorder_point),
        reorderQuantity: Number(row.reorder_quantity),
        leadTimeDays: Number(row.lead_time_days),
        supplier: row.supplier,
      },
      create: {
        sku: row.sku,
        name: row.name,
        unitCost: row.unit_cost,
        onHandCount: Number(row.on_hand_count),
        reorderPoint: Number(row.reorder_point),
        reorderQuantity: Number(row.reorder_quantity),
        leadTimeDays: Number(row.lead_time_days),
        supplier: row.supplier,
      },
    });
  }
  console.log(`Seeded ${rows.length} synthetic parts.`);
}

/** job_type_rules — spec §10.1. Never hard-coded into the derivation engine; this table is the source of truth. */
async function seedJobTypeRules() {
  const rules = [
    { jobType: "CAT1_TEST" as const, intervalDays: 365, sourceField: "cat1_latest_report_filed", description: "Annual Category 1 elevator safety test" },
    { jobType: "CAT5_TEST" as const, intervalDays: 1825, sourceField: "cat5_latest_report_filed", description: "Category 5 full-load test, every 5 years" },
    { jobType: "PERIODIC_INSPECTION" as const, intervalDays: 182, sourceField: "periodic_latest_inspection", description: "DOB-contracted periodic inspection, twice per year" },
    { jobType: "BOILER_PERIODIC" as const, intervalDays: 365, sourceField: "inspection_date", description: "Low-pressure boiler annual inspection" },
    { jobType: "BOILER_EXTERNAL" as const, intervalDays: 365, sourceField: "inspection_date", description: "High-pressure boiler external inspection, ~2x/year offset from internal" },
    { jobType: "BOILER_INTERNAL" as const, intervalDays: 365, sourceField: "inspection_date", description: "High-pressure boiler internal inspection, ~2x/year, staggered ~6mo from external" },
  ];

  for (const rule of rules) {
    await prisma.jobTypeRule.upsert({
      where: { jobType: rule.jobType },
      update: rule,
      create: rule,
    });
  }
  console.log(`Seeded ${rules.length} job_type_rules.`);
}

async function main() {
  await seedUsers();
  await seedTeams();
  await seedParts();
  await seedJobTypeRules();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
