import dotenv from 'dotenv';
import { initSchema } from '../db.js';
import { getGradingStandardsLinkSummary } from '../productMasterLink.js';

dotenv.config();

async function main() {
  await initSchema();
  const summary = await getGradingStandardsLinkSummary();
  console.log('Grading standards:', summary.totalRules);
  console.log('Linked rules:', summary.linkedRules);
  console.log('Unlinked rules:', summary.unlinkedRules);
  console.log('Unlinked product codes:', summary.unlinkedProducts.length);
  for (const u of summary.unlinkedProducts) {
    console.log(`  ${u.prod_code} | ${u.prod_name} (${u.rule_count} rules)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
