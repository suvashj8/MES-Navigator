import { useEffect, useMemo, useState } from 'react';
import { api, type Staff } from '../api';
import PageShell from '../components/PageShell';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { blockNegativeNumberKey, sanitizeNonNegativeIntegerInput } from '../utils/numericInput';
import { blockPersonNameKey, isValidPersonName, sanitizePersonNameInput } from '../utils/textInput';

const PAGE_SIZE = 10;

export default function StaffMaster() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const canWrite = can('staff:write');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [showFormer, setShowFormer] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [newDept, setNewDept] = useState('Production');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  function load() {
    api
      .staff({
        department: department || undefined,
        q: q || undefined,
        all: showFormer && canWrite ? true : undefined,
      })
      .then(setStaff);
  }

  useEffect(() => {
    api.departments().then(setDepartments);
  }, []);

  useEffect(() => {
    load();
  }, [department, q, showFormer, canWrite]);

  useEffect(() => {
    setPage(0);
  }, [department, q, showFormer]);

  const totalRows = staff.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE) || 1);
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = totalRows === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const pageEnd = Math.min((safePage + 1) * PAGE_SIZE, totalRows);

  const paginatedStaff = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return staff.slice(start, start + PAGE_SIZE);
  }, [staff, safePage]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active !== 0), [staff]);
  const formerCount = useMemo(() => staff.filter((s) => s.is_active === 0).length, [staff]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const reg = Number(regNo);
      if (!Number.isInteger(reg) || reg <= 0) {
        setError('Registration number must be a positive integer');
        return;
      }
      const trimmedName = name.trim();
      if (!isValidPersonName(trimmedName)) {
        setError('Name must use letters only (no numbers or minus signs)');
        return;
      }
      await api.createStaff(
        { reg_no: reg, name: trimmedName, department: newDept },
        photoFile
      );
      setShowAdd(false);
      setRegNo('');
      setName('');
      setPhotoFile(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff');
    }
  }

  async function handleFire(s: Staff) {
    const ok = await confirm({
      title: 'Fire worker',
      message: `Fire ${s.name} (Reg #${s.reg_no})?\n\nThey will be removed from daily entry and worker lists. Past grading records are kept.`,
      confirmLabel: 'Fire',
      variant: 'danger',
    });
    if (!ok) return;
    setError('');
    setBusyId(s.id);
    try {
      await api.updateStaff(s.id, { is_active: 0 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fire staff');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRehire(s: Staff) {
    const ok = await confirm({
      title: 'Rehire worker',
      message: `Rehire ${s.name} (Reg #${s.reg_no})? They will appear in daily entry again.`,
      confirmLabel: 'Rehire',
    });
    if (!ok) return;
    setError('');
    setBusyId(s.id);
    try {
      await api.updateStaff(s.id, { is_active: 1 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rehire staff');
    } finally {
      setBusyId(null);
    }
  }

  function onPickPhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 700_000) {
      setError('Image is too large. Please use a smaller photo (under 700 KB).');
      return;
    }
    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  const byDept = activeStaff.reduce<Record<string, Staff[]>>((acc, s) => {
    (acc[s.department] ||= []).push(s);
    return acc;
  }, {});

  return (
    <PageShell>
      <header className="flex justify-between items-end mb-8 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Staff Master</h2>
          <p className="text-slate-400 text-sm mt-1">
            {showFormer && canWrite
              ? `${activeStaff.length} active · ${formerCount} former`
              : `${activeStaff.length} active workers`}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm"
          >
            + Add Staff
          </button>
        )}
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          placeholder="Search name or reg no..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {canWrite && (
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showFormer}
              onChange={(e) => setShowFormer(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            Show former staff
          </label>
        )}
      </div>

      {error && !showAdd && <p className="mb-4 text-red-400 text-sm">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="p-3">Reg #</th>
              <th className="p-3">Staff Name</th>
              <th className="p-3">Department</th>
              {showFormer && canWrite && <th className="p-3">Status</th>}
              {canWrite && <th className="p-3 w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedStaff.map((s) => {
              const inactive = s.is_active === 0;
              return (
                <tr
                  key={s.id}
                  className={`border-t border-slate-800 ${inactive ? 'opacity-70' : ''}`}
                >
                  <td className="p-3 font-mono">{s.reg_no}</td>
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-xs">{s.department}</span>
                  </td>
                  {showFormer && canWrite && (
                    <td className="p-3">
                      <span className={inactive ? 'text-red-400' : 'text-emerald-400'}>
                        {inactive ? 'Former' : 'Active'}
                      </span>
                    </td>
                  )}
                  {canWrite && (
                    <td className="p-3">
                      {inactive ? (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => handleRehire(s)}
                          className="text-emerald-400 hover:underline text-xs disabled:opacity-50"
                        >
                          Rehire
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => handleFire(s)}
                          className="text-red-400 hover:underline text-xs disabled:opacity-50"
                        >
                          Fire
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td colSpan={canWrite ? (showFormer ? 5 : 4) : 3} className="p-6 text-center text-slate-500">
                  No staff found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalRows > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-slate-500">
            Showing {pageStart}–{pageEnd} of {totalRows}
            <span className="text-slate-600"> · {PAGE_SIZE} per page</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-400 tabular-nums min-w-[5.5rem] text-center">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(byDept).map(([dept, list]) => (
          <div key={dept} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400">{dept}</p>
            <p className="text-2xl font-bold text-amber-300">{list.length}</p>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAdd}
            className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-3"
          >
            <h3 className="font-semibold">Add Staff</h3>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Registration #"
              value={regNo}
              onChange={(e) => setRegNo(sanitizeNonNegativeIntegerInput(e.target.value))}
              onKeyDown={blockNegativeNumberKey}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
            />
            <input
              type="text"
              inputMode="text"
              autoComplete="name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(sanitizePersonNameInput(e.target.value))}
              onKeyDown={blockPersonNameKey}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
            />
            <select
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="Production">Production</option>
            </select>

            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Staff photo preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-500">Photo</span>
                )}
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1">Staff photo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200 hover:file:bg-slate-700"
                />
                {photoFile && (
                  <button
                    type="button"
                    onClick={() => onPickPhoto(null)}
                    className="mt-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold">
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border border-slate-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
