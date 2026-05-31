/**
 * Link grading_standards to product_master by matching prod_code = code.
 */
import { all, one, run, transaction } from './db.js';

export async function getGradingStandardsLinkSummary() {
  const unlinkedProducts = await all(
    `
    SELECT gs.prod_code, gs.prod_name, COUNT(*)::int AS rule_count
    FROM grading_standards gs
    LEFT JOIN product_master pm ON pm.code = gs.prod_code
    WHERE pm.id IS NULL
    GROUP BY gs.prod_code, gs.prod_name
    ORDER BY gs.prod_code
    `
  );

  const unlinkedRules = (await one(
    `
    SELECT COUNT(*)::int AS c
    FROM grading_standards gs
    LEFT JOIN product_master pm ON pm.code = gs.prod_code
    WHERE pm.id IS NULL
    `
  ))?.c ?? 0;

  const linkedRules = (await one(
    `
    SELECT COUNT(*)::int AS c
    FROM grading_standards gs
    INNER JOIN product_master pm ON pm.code = gs.prod_code
    `
  ))?.c ?? 0;

  const totalRules = (await one('SELECT COUNT(*)::int AS c FROM grading_standards'))?.c ?? 0;
  const productMasterCount = (await one('SELECT COUNT(*)::int AS c FROM product_master'))?.c ?? 0;

  return {
    totalRules,
    linkedRules,
    unlinkedRules,
    unlinkedProducts: unlinkedProducts.map((r) => ({
      prod_code: r.prod_code,
      prod_name: r.prod_name,
      rule_count: r.rule_count,
    })),
  };
}

export async function linkGradingStandardsToProductMaster({ createMissing = false, createdBy = 'system' } = {}) {
  let productsCreated = 0;
  let rulesLinked = 0;

  await transaction(async (tx) => {
    if (createMissing) {
      const missing = await tx.all(
        `
        SELECT DISTINCT TRIM(gs.prod_code) AS prod_code, TRIM(gs.prod_name) AS prod_name
        FROM grading_standards gs
        WHERE TRIM(gs.prod_code) != ''
          AND NOT EXISTS (
            SELECT 1 FROM product_master pm WHERE pm.code = TRIM(gs.prod_code)
          )
        `
      );

      for (const row of missing) {
        const code = String(row.prod_code || '').trim();
        const description = String(row.prod_name || code).trim();
        if (!code || !description) continue;
        try {
          await tx.run(
            `
            INSERT INTO product_master (
              code, description,
              base_uom, type, product_type, product_nature,
              vat_category,
              created_at, updated_at, created_by, updated_by
            ) VALUES (
              ?, ?,
              'pcs', 'Stock', 'TradingGoods', 'FinishedGood',
              'standard_13',
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?
            )
            `,
            [code, description, createdBy, createdBy]
          );
          productsCreated += 1;
        } catch (e) {
          if (!String(e.message).includes('unique') && !String(e.message).includes('duplicate')) throw e;
        }
      }
    }

    const linkResult = await tx.run(
      `
      UPDATE grading_standards
      SET
        product_master_id = (
          SELECT id FROM product_master WHERE code = TRIM(grading_standards.prod_code)
        ),
        prod_name = COALESCE(
          (SELECT description FROM product_master WHERE code = TRIM(grading_standards.prod_code)),
          prod_name
        )
      WHERE EXISTS (
        SELECT 1 FROM product_master pm WHERE pm.code = TRIM(grading_standards.prod_code)
      )
      `
    );
    rulesLinked = linkResult.changes;
  });

  const summary = await getGradingStandardsLinkSummary();

  return {
    ok: true,
    productsCreated,
    rulesLinked,
    ...summary,
  };
}

export async function cascadeProductMasterCodeChange(productId, oldCode, newCode, newDescription) {
  const old = String(oldCode || '').trim();
  const code = String(newCode || '').trim();
  const description = String(newDescription || '').trim();
  if (!code || !description) return { gradingStandards: 0, dailyGrading: 0, missingStandards: 0 };

  const gs = await run(
    `
    UPDATE grading_standards
    SET prod_code = ?, prod_name = ?, product_master_id = ?
    WHERE product_master_id = ?
       OR (prod_code = ? AND (product_master_id IS NULL OR product_master_id = ?))
    `,
    [code, description, productId, productId, old, productId]
  );

  let dailyGrading = 0;
  let missingStandards = 0;
  if (old && old !== code) {
    dailyGrading = (await run('UPDATE daily_grading SET prod_code = ? WHERE prod_code = ?', [code, old])).changes;
    missingStandards = (
      await run('UPDATE missing_standards SET prod_code = ?, prod_name = ? WHERE prod_code = ?', [
        code,
        description,
        old,
      ])
    ).changes;
  } else {
    await run('UPDATE grading_standards SET prod_name = ? WHERE product_master_id = ?', [description, productId]);
  }

  return {
    gradingStandards: gs.changes,
    dailyGrading,
    missingStandards,
  };
}
