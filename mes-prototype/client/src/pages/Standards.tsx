import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, type GradingStandard, type StandardInput, type CostCenter } from '../api';
import { useAuth } from '../context/AuthContext';

const emptyForm: StandardInput = {
  prod_code: '',
  prod_name: '',
  cost_center_code: '',
  cost_center_name: '',
  standard_min: 420,
  std_qty: 0,
  c_value: 0,
  b_value: 0,
  a_value: 0,
  aplus_value: 0,
  effective_date: '',
};

export default function Standards() {
  const { can } = useAuth();
  const canWrite = can('standards:write');
  const location = useLocation();
  const [standards, setStandards] = useState<GradingStandard[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<StandardInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.gradingStandards(q.length >= 2 ? q : undefined).then(setStandards);
  }

  useEffect(() => {
    api.costCenters().then(setCostCenters);
    load();
  }, []);

  // Allow deep links like /standards?q=ABC123
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const qParam = sp.get('q');
    if (qParam && qParam !== q) setQ(qParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]);

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setModal('add');
    setError('');
  }

  function openEdit(s: GradingStandard) {
    setForm({
      prod_code: s.prod_code,
      prod_name: s.prod_name,
      cost_center_code: s.cost_center_code,
      cost_center_name: s.cost_center_name,
      standard_min: s.standard_min,
      std_qty: s.std_qty,
      c_value: s.c_value,
      b_value: s.b_value,
      a_value: s.a_value,
      aplus_value: s.aplus_value,
      effective_date: s.effective_date || '',
    });
    setEditId(s.id);
    setModal('edit');
    setError('');
  }

  function onCostCenterChange(code: string) {
    const cc = costCenters.find((c) => c.code === code);
    setForm((f) => ({
      ...f,
      cost_center_code: code,
      cost_center_name: cc?.name || f.cost_center_name,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = { ...form, effective_date: form.effective_date || null };
      if (modal === 'add') await api.createStandard(body);
      else if (editId) await api.updateStandard(editId, body);
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this grading standard?')) return;
    await api.deleteStandard(id);
    load();
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold">Grading rules</h2>
          <p className="text-slate-400 text-sm mt-1">Product × work station rules — C / B / A / A+ thresholds</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm"
          >
            + Add Standard
          </button>
        )}
      </header>

      <input
        placeholder="Search product code, name, or work station..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm mb-6"
      />

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[10%]" />
            {canWrite && <col className="w-[15%]" />}
          </colgroup>
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="p-2 text-left align-bottom">Product</th>
              <th className="p-2 text-left align-bottom">Work station</th>
              <th className="p-2 text-right align-bottom">Std</th>
              <th className="p-2 text-right align-bottom">C</th>
              <th className="p-2 text-right align-bottom">B</th>
              <th className="p-2 text-right align-bottom">A</th>
              <th className="p-2 text-right align-bottom">A+</th>
              <th className="p-2 text-left align-bottom whitespace-nowrap">Eff.</th>
              {canWrite && <th className="p-2 text-left align-bottom whitespace-nowrap">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {standards.map((s) => (
              <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                <td className="p-2 align-top">
                  <span className="font-mono text-amber-200/90">{s.prod_code}</span>
                  <p className="text-slate-500 truncate">{s.prod_name}</p>
                </td>
                <td className="p-2 align-top">
                  <span className="font-mono">{s.cost_center_code}</span>
                  <p className="text-slate-500 truncate">{s.cost_center_name}</p>
                </td>
                <td className="p-2 text-right align-top font-medium tabular-nums">{s.std_qty}</td>
                <td className="p-2 text-right align-top text-red-400/80 tabular-nums">{s.c_value}</td>
                <td className="p-2 text-right align-top text-orange-400/80 tabular-nums">{s.b_value}</td>
                <td className="p-2 text-right align-top text-emerald-400/80 tabular-nums">{s.a_value}</td>
                <td className="p-2 text-right align-top text-amber-400/80 tabular-nums">{s.aplus_value}</td>
                <td className="p-2 text-left align-top text-slate-500 whitespace-nowrap tabular-nums">
                  {s.effective_date || '—'}
                </td>
                {canWrite && (
                  <td className="p-2 align-top whitespace-nowrap">
                    <button type="button" onClick={() => openEdit(s)} className="text-amber-400 hover:underline mr-2">Edit</button>
                    <button type="button" onClick={() => handleDelete(s.id)} className="text-red-400 hover:underline">Del</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-3">
            <h3 className="font-semibold text-lg">{modal === 'add' ? 'Add' : 'Edit'} Grading Standard</h3>

            <Field label="Product Code" value={form.prod_code} onChange={(v) => setForm({ ...form, prod_code: v.toUpperCase() })} />
            <Field label="Product Name" value={form.prod_name} onChange={(v) => setForm({ ...form, prod_name: v })} />
            <div>
              <label className="text-xs text-slate-400">Work station</label>
              <select
                value={form.cost_center_code}
                onChange={(e) => onCostCenterChange(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {costCenters.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Std Qty (B)" value={form.std_qty} onChange={(v) => setForm({ ...form, std_qty: v })} />
              <NumField label="Standard Min" value={form.standard_min ?? 420} onChange={(v) => setForm({ ...form, standard_min: v })} />
              <NumField label="C Value" value={form.c_value} onChange={(v) => setForm({ ...form, c_value: v })} />
              <NumField label="B Value" value={form.b_value} onChange={(v) => setForm({ ...form, b_value: v })} />
              <NumField label="A Value" value={form.a_value} onChange={(v) => setForm({ ...form, a_value: v })} />
              <NumField label="A+ Value" value={form.aplus_value} onChange={(v) => setForm({ ...form, aplus_value: v })} />
            </div>
            <Field label="Effective Date" value={form.effective_date || ''} onChange={(v) => setForm({ ...form, effective_date: v })} type="date" />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" required={type !== 'date'} />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input type="number" step="any" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" required />
    </div>
  );
}
