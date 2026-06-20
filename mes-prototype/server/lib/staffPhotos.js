import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, '..');

export const STAFF_UPLOAD_DIR = process.env.STAFF_UPLOAD_DIR
  ? path.resolve(process.env.STAFF_UPLOAD_DIR)
  : path.join(SERVER_DIR, 'uploads', 'staff');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function ensureStaffUploadDir() {
  fs.mkdirSync(STAFF_UPLOAD_DIR, { recursive: true });
}

export function staffPhotoRelativePath(staffId, ext) {
  return path.posix.join('staff', `${staffId}${ext}`);
}

export function resolveStaffPhotoPath(relativePath) {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.resolve(SERVER_DIR, 'uploads', normalized);
  const uploadsRoot = path.resolve(SERVER_DIR, 'uploads');
  if (!abs.startsWith(uploadsRoot)) return null;
  return abs;
}

export function deleteStaffPhotoFile(relativePath) {
  const abs = resolveStaffPhotoPath(relativePath);
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Save image bytes for a staff member. Returns DB-relative path (e.g. staff/12.jpg).
 */
export async function saveStaffPhotoBuffer(staffId, buffer, mimeType) {
  ensureStaffUploadDir();
  const ext = MIME_EXT[mimeType] || '.jpg';
  const relative = staffPhotoRelativePath(staffId, ext);
  const abs = resolveStaffPhotoPath(relative);
  if (!abs) throw new Error('Invalid photo path');
  await fs.promises.writeFile(abs, buffer);
  return relative;
}

/** Parse data:image/...;base64,... URL into { buffer, mimeType }. */
export function parseDataUrlPhoto(dataUrl) {
  const s = String(dataUrl || '').trim();
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(s);
  if (!m) return null;
  const mimeType = m[1];
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length === 0) return null;
  return { buffer, mimeType };
}

import { formatStaffRegNo } from './staffRegNo.js';

export function formatStaffRow(row) {
  if (!row) return null;
  const has_photo = Boolean(row.has_photo ?? row.photo_path);
  return {
    id: row.id,
    reg_no: row.reg_no,
    reg_display: formatStaffRegNo(row.reg_no),
    name: row.name,
    department: row.department,
    is_active: row.is_active,
    has_photo,
    photo_url: has_photo ? `/api/staff/${row.id}/photo` : null,
  };
}

/** Excludes photo_data blob from list responses; has_photo covers legacy rows until migrated. */
export const STAFF_LIST_COLUMNS = `
  id, reg_no, name, department, is_active, photo_path,
  (photo_path IS NOT NULL OR photo_data IS NOT NULL) AS has_photo
`;
