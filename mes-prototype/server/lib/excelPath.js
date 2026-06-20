import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FALLBACK_PATHS = [
  path.join(__dirname, '..', '..', 'bead for life (1).xlsx'),
  path.join(__dirname, '..', '..', '..', 'bead for life (1).xlsx'),
  path.join(__dirname, '..', 'data', 'bead-for-life.xlsx'),
];

/** Resolve Excel workbook path (env EXCEL_PATH, then known locations). */
export function resolveExcelPath() {
  const fromEnv = process.env.EXCEL_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  for (const p of FALLBACK_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  if (fromEnv) return fromEnv;
  return FALLBACK_PATHS[0];
}
