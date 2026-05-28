import { useEffect, useState } from 'react';
import { api, type Staff } from '../api';
import { useAuth } from '../context/AuthContext';

export default function StaffMaster() {
  const { can } = useAuth();
  const canAdd = can('staff:write');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [name, setName] = useState('');
  const [newDept, setNewDept] = useState('Production');
  const [photoData, setPhotoData] = useState<string>('');
  const [error, setError] = useState('');

  function load() {
    api.staff({ department: department || undefined, q: q || undefined }).then(setStaff);
  }

  useEffect(() => {
    api.departments().then(setDepartments);
  }, []);

  useEffect(() => { load(); }, [department, q]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createStaff({
        reg_no: Number(regNo),
        name,
        department: newDept,
        photo_data: photoData || null,
      });
      setShowAdd(false);
      setRegNo('');
      setName('');
      setPhotoData('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff');
    }
  }

  async function onPickPhoto(file: File | null) {
    if (!file) {
      setPhotoData('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    // Keep this lightweight for SQLite: warn on huge images.
    if (file.size > 700_000) {
      setError('Image is too large. Please use a smaller photo (under 700 KB).');
      return;
    }
    const reader = new FileReader();
    const data: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
    setError('');
    setPhotoData(data);
  }

  const byDept = staff.reduce<Record<string, Staff[]>>((acc, s) => {
    (acc[s.department] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold">Staff Master</h2>
          <p className="text-slate-400 text-sm mt-1">{staff.length} workers</p>
        </div>
        {canAdd && (
          <button type="button" onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
            + Add Staff
          </button>
        )}
      </header>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input placeholder="Search name or reg no..." value={q} onChange={(e) => setQ(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <select value={department} onChange={(e) => setDepartment(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="p-3">Reg #</th>
              <th className="p-3">Staff Name</th>
              <th className="p-3">Department</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="p-3 font-mono">{s.reg_no}</td>
                <td className="p-3">{s.name}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-xs">{s.department}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm space-y-3">
            <h3 className="font-semibold">Add Staff</h3>
            <input type="number" placeholder="Registration #" value={regNo} onChange={(e) => setRegNo(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" />
            <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" />
            <select value={newDept} onChange={(e) => setNewDept(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              <option value="Production">Production</option>
            </select>

            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                {photoData ? (
                  <img src={photoData} alt="Staff photo preview" className="h-full w-full object-cover" />
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
                {photoData && (
                  <button
                    type="button"
                    onClick={() => setPhotoData('')}
                    className="mt-2 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold">Save</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-700 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
