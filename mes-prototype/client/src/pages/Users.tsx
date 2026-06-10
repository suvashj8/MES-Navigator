import { useEffect, useState } from 'react';
import { api, type AppUser, type UserInput } from '../api';
import ModalCloseButton from '../components/ModalCloseButton';
import PageShell from '../components/PageShell';

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<UserInput & { is_active?: number }>({
    username: '', password: '', role: 'operator', display_name: '', department: null,
  });
  const [error, setError] = useState('');

  function load() {
    api.users().then(setUsers);
  }

  useEffect(() => {
    load();
    api.departments().then((rows) => setDeptOptions(rows.map((d) => d.name)));
  }, []);

  function openAdd() {
    setForm({ username: '', password: '', role: 'operator', display_name: '' });
    setEditId(null);
    setModal('add');
    setError('');
  }

  function openEdit(u: AppUser) {
    setForm({
      username: u.username, password: '', role: u.role, display_name: u.display_name,
      department: u.department, is_active: u.is_active,
    });
    setEditId(u.id);
    setModal('edit');
    setError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (modal === 'add') {
        if (!form.password) { setError('Password required'); return; }
        await api.createUser(form);
      } else if (editId) {
        await api.updateUser(editId, {
          role: form.role,
          display_name: form.display_name,
          department: form.role === 'supervisor' ? form.department : null,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <PageShell>
      <header className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-slate-400 text-sm mt-1">Manage system accounts and roles</p>
        </div>
        <button type="button" onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
          + Add User
        </button>
      </header>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="p-3">Username</th>
              <th className="p-3">Display Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Department</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-800">
                <td className="p-3 font-mono">{u.username}</td>
                <td className="p-3">{u.display_name}</td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3 text-slate-400">{u.department || '—'}</td>
                <td className="p-3">
                  <span className={u.is_active ? 'text-emerald-400' : 'text-red-400'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3">
                  <button type="button" onClick={() => openEdit(u)} className="text-amber-400 hover:underline text-xs">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 pt-12 w-full max-w-md space-y-3">
            <ModalCloseButton onClick={() => setModal(null)} className="absolute right-4 top-4 z-10" />
            <h3 className="font-semibold pr-10">{modal === 'add' ? 'Add User' : 'Edit User'}</h3>
            {modal === 'add' && (
              <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
            )}
            <Field label="Display Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
            <div>
              <label className="text-xs text-slate-400">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserInput['role'] })}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="operator">Operator</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === 'supervisor' && (
              <div>
                <label className="text-xs text-slate-400">Department (required for supervisor)</label>
                <select
                  value={form.department || ''}
                  onChange={(e) => setForm({ ...form, department: e.target.value || null })}
                  required
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select department...</option>
                  {deptOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Field label={modal === 'add' ? 'Password' : 'New Password (leave blank to keep)'}
              value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
            {modal === 'edit' && (
              <div>
                <label className="text-xs text-slate-400">Status</label>
                <select value={form.is_active ?? 1} onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold">Save</button>
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-700">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={type !== 'password'}
        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
    </div>
  );
}
