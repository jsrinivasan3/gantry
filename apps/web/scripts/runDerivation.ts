import { deriveMainSchedule } from "../src/server/scheduling/deriveAll";
import { computeWarnings } from "../src/server/scheduling/warnings";
import { prisma } from "../src/server/db/client";

async function main() {
  const result = await deriveMainSchedule();
  console.log(JSON.stringify(result, null, 2));
  const warnings = await computeWarnings(null);
  console.log(`Warnings: ${warnings.length}`);
  console.log(warnings.slice(0, 5));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
