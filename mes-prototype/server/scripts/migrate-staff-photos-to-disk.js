/**
 * Move legacy staff.photo_data (base64 data URLs) to server/uploads/staff/.
 * Clears photo_data after successful write.
 *
 *   node scripts/migrate-staff-photos-to-disk.js
 *   node scripts/migrate-staff-photos-to-disk.js --dry-run
 */
import { all, run } from '../db.js';
import {
  parseDataUrlPhoto,
  saveStaffPhotoBuffer,
  deleteStaffPhotoFile,
} from '../lib/staffPhotos.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const rows = await all(
    `SELECT id, photo_path, photo_data FROM staff
     WHERE photo_data IS NOT NULL AND TRIM(photo_data) <> ''`
  );
  console.log(`Found ${rows.length} staff row(s) with photo_data in DB`);
  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const parsed = parseDataUrlPhoto(row.photo_data);
    if (!parsed) {
      console.warn(`  skip id=${row.id}: invalid data URL`);
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`  would migrate id=${row.id} (${parsed.buffer.length} bytes)`);
      migrated += 1;
      continue;
    }
    if (row.photo_path) deleteStaffPhotoFile(row.photo_path);
    const relative = await saveStaffPhotoBuffer(row.id, parsed.buffer, parsed.mimeType);
    await run('UPDATE staff SET photo_path = ?, photo_data = NULL WHERE id = ?', [relative, row.id]);
    console.log(`  migrated id=${row.id} -> ${relative}`);
    migrated += 1;
  }

  console.log(dryRun ? `Dry run: ${migrated} would migrate, ${skipped} skipped` : `Done: ${migrated} migrated, ${skipped} skipped`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
