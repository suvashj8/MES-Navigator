import { run } from '../db.js';

export function pickAuditValues(row) {
  if (!row) return null;
  return {
    id: row.id,
    entry_date: row.entry_date,
    staff_id: row.staff_id,
    prod_code: row.prod_code,
    cost_center_code: row.cost_center_code,
    quantity: row.quantity,
    grade: row.grade,
    remarks: row.remarks,
    entered_by: row.entered_by,
    created_at: row.created_at,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
    deleted_by: row.deleted_by,
    deleted_at: row.deleted_at,
  };
}

export async function writeDailyAudit({ entry_id, action, actor, oldRow, newRow }) {
  await run(
    `INSERT INTO daily_grading_audit (entry_id, action, actor, old_values, new_values)
     VALUES (?, ?, ?, ?, ?)`,
    [
      entry_id,
      action,
      actor || null,
      oldRow ? JSON.stringify(pickAuditValues(oldRow)) : null,
      newRow ? JSON.stringify(pickAuditValues(newRow)) : null,
    ]
  );
}
