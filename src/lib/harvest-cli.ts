import { harvestAll } from "./harvester";
import { analyzeUnprocessed } from "./analyzer";

async function main() {
  console.log("[CLI] Starting full harvest...");
  const results = await harvestAll();

  let totalAdded = 0;
  for (const r of results) {
    if (r.added > 0) {
      console.log(`  ${r.source}: +${r.added} articles`);
      totalAdded += r.added;
    }
  }
  console.log(`[CLI] Harvest complete. ${totalAdded} new articles added.`);

  if (totalAdded > 0) {
    console.log("[CLI] Analyzing new articles...");
    const analyzed = await analyzeUnprocessed(totalAdded);
    console.log(`[CLI] Analysis complete. ${analyzed} articles analyzed.`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
