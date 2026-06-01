import fs from 'fs';
import { one, all, run } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { can } from '../auth.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { assertPersonName } from '../validateText.js';
import { staffPhotoUpload } from '../lib/staffPhotoUpload.js';
import {
  formatStaffRow,
  STAFF_LIST_COLUMNS,
  saveStaffPhotoBuffer,
  resolveStaffPhotoPath,
  parseDataUrlPhoto,
  deleteStaffPhotoFile,
} from '../lib/staffPhotos.js';

export function registerStaffRoutes(app) {
  app.get('/api/staff/:id/photo', requirePermission('reports:read'), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const row = await one('SELECT photo_path, photo_data FROM staff WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });

    if (row.photo_path) {
      const abs = resolveStaffPhotoPath(row.photo_path);
      if (abs && fs.existsSync(abs)) {
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.sendFile(abs);
      }
    }

    const legacy = row.photo_data && String(row.photo_data).startsWith('data:');
    if (legacy) {
      const parsed = parseDataUrlPhoto(row.photo_data);
      if (!parsed) return res.status(404).json({ error: 'Photo not found' });
      try {
        const relative = await saveStaffPhotoBuffer(id, parsed.buffer, parsed.mimeType);
        await run('UPDATE staff SET photo_path = ?, photo_data = NULL WHERE id = ?', [relative, id]);
      } catch {
        /* still serve even if migration write fails */
      }
      res.setHeader('Content-Type', parsed.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.send(parsed.buffer);
    }

    return res.status(404).json({ error: 'Photo not found' });
  }));

  app.get('/api/staff', requirePermission('reports:read'), asyncHandler(async (req, res) => {
    const { q } = req.query;
    const { department } = resolveDepartment(req, req.query.department);
    const showAll = req.query.all === '1';
    if (showAll && !can(req.user.role, 'staff:write')) {
      return res.status(403).json({ error: 'Not allowed to view inactive staff' });
    }
    let sql = `SELECT ${STAFF_LIST_COLUMNS} FROM staff WHERE 1=1`;
    const params = [];
    if (!showAll) sql += ' AND is_active = 1';
    if (department) {
      sql += ' AND department = ?';
      params.push(department);
    }
    if (q) {
      sql += ' AND (name LIKE ? OR CAST(reg_no AS TEXT) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY is_active DESC, reg_no';
    const rows = await all(sql, [...params]);
    res.json(rows.map(formatStaffRow));
  }));

  app.post(
    '/api/staff',
    requirePermission('staff:write'),
    staffPhotoUpload.single('photo'),
    asyncHandler(async (req, res) => {
      const { reg_no, name, department } = req.body;
      const reg = Number(reg_no);
      if (!Number.isInteger(reg) || reg <= 0) {
        return res.status(400).json({ error: 'Registration number must be a positive integer' });
      }
      let cleanName;
      try {
        cleanName = assertPersonName(name);
      } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
      }
      if (!department || String(department).trim().length < 1) {
        return res.status(400).json({ error: 'Department is required' });
      }

      const r = await run(
        'INSERT INTO staff (reg_no, name, department, photo_path) VALUES (?, ?, ?, ?)',
        [reg, cleanName, String(department).trim(), null]
      );
      const id = Number(r.lastInsertRowid);

      if (req.file) {
        const relative = await saveStaffPhotoBuffer(id, req.file.buffer, req.file.mimetype);
        await run('UPDATE staff SET photo_path = ? WHERE id = ?', [relative, id]);
      }

      const row = await one(`SELECT ${STAFF_LIST_COLUMNS} FROM staff WHERE id = ?`, [id]);
      res.json(formatStaffRow(row));
    })
  );

  app.patch('/api/staff/:id', requirePermission('staff:write'), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await one(`SELECT ${STAFF_LIST_COLUMNS} FROM staff WHERE id = ?`, [id]);
    if (!row) return res.status(404).json({ error: 'Staff not found' });

    const { is_active } = req.body ?? {};
    if (is_active == null) {
      return res.status(400).json({ error: 'is_active is required' });
    }
    const nextActive = is_active ? 1 : 0;
    if (row.is_active === nextActive) {
      return res.json(formatStaffRow(row));
    }
    await run('UPDATE staff SET is_active = ? WHERE id = ?', [nextActive, id]);
    const updated = await one(`SELECT ${STAFF_LIST_COLUMNS} FROM staff WHERE id = ?`, [id]);
    res.json(formatStaffRow(updated));
  }));

  app.delete('/api/staff/:id/photo', requirePermission('staff:write'), asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await one('SELECT photo_path FROM staff WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Staff not found' });
    if (row.photo_path) deleteStaffPhotoFile(row.photo_path);
    await run('UPDATE staff SET photo_path = NULL, photo_data = NULL WHERE id = ?', [id]);
    const updated = await one(`SELECT ${STAFF_LIST_COLUMNS} FROM staff WHERE id = ?`, [id]);
    res.json(formatStaffRow(updated));
  }));
}
