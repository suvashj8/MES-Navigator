import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type GradingStandard, type ProductMasterListRow, type StandardInput, type CostCenter } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import ModalCloseButton from '../components/ModalCloseButton';
import PageShell from '../components/PageShell';
import {
  blockNegativeNumberKey,
  parseNonNegativeNumber,
  sanitizeNonNegativeDecimalInput,
} from '../utils/numericInput';

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

const PAGE_SIZE = 10;

export default function Standards() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const canWrite = can('standards:write');
  const location = useLocation();
  const [standards, setStandards] = useState<GradingStandard[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [masterProducts, setMasterProducts] = useState<ProductMasterListRow[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<StandardInput>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [showProductsWithoutRules, setShowProductsWithoutRules] = useState(true);
  const [page, setPage] = useState(0);

  function load() {
    api.gradingStandards().then(setStandards);
  }

  function loadMasterProducts(search?: string) {
    return api
      .productMasterList({ q: search || undefined, offset: 0, limit: 200 })
      .then((r) => setMasterProducts(r.rows));
  }

  useEffect(() => {
    api.costCenters().then(setCostCenters);
    loadMasterProducts();
    load();
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const qParam = sp.get('q');
    if (qParam) setQ(qParam);
    const codeParam = sp.get('prod_code');
    if (codeParam && canWrite) {
      setForm((f) => ({ ...f, prod_code: codeParam }));
      setModal('add');
    }
  }, [location.search, canWrite]);

  useEffect(() => {
    load();
    if (q.trim()) {
      void loadMasterProducts(q.trim());
    } else {
      void loadMasterProducts();
    }
  }, [q]);

  const rulesByCode = useMemo(() => {
    const m = new Map<string, GradingStandard[]>();
    for (const s of standards) {
      const list = m.get(s.prod_code) || [];
      list.push(s);
      m.set(s.prod_code, list);
    }
    return m;
  }, [standards]);

  const productsWithoutRules = useMemo(() => {
    return masterProducts.filter((p) => !rulesByCode.has(p.code));
  }, [masterProducts, rulesByCode]);

  type DisplayRow =
    | { kind: 'rule'; rule: GradingStandard }
    | { kind: 'product'; product: ProductMasterListRow };

  const displayRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows: DisplayRow[] = [];

    const matchesSearch = (parts: (string | null | undefined)[]) => {
      if (!needle) return true;
      const hay = parts.filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    };

    for (const s of standards) {
      if (showUnlinkedOnly && s.in_product_master) continue;
      if (
        !matchesSearch([
          s.prod_code,
          s.prod_name,
          s.master_description,
          s.cost_center_code,
          s.cost_center_name,
        ])
      ) {
        continue;
      }
      rows.push({ kind: 'rule', rule: s });
    }

    if (!showUnlinkedOnly && showProductsWithoutRules) {
      for (const p of masterProducts) {
        if (rulesByCode.has(p.code)) continue;
        if (!matchesSearch([p.code, p.description])) continue;
        rows.push({ kind: 'product', product: p });
      }
    }

    rows.sort((a, b) => {
      const codeA = a.kind === 'rule' ? a.rule.prod_code : a.product.code;
      const codeB = b.kind === 'rule' ? b.rule.prod_code : b.product.code;
      const c = codeA.localeCompare(codeB);
      if (c !== 0) return c;
      if (a.kind === 'rule' && b.kind === 'rule') {
        return a.rule.cost_center_code.localeCompare(b.rule.cost_center_code);
      }
      return a.kind === 'product' ? 1 : -1;
    });

    return rows;
  }, [standards, masterProducts, q, showUnlinkedOnly, showProductsWithoutRules, rulesByCode]);

  const totalDisplayRows = displayRows.length;
  const totalPages = Math.max(1, Math.ceil(totalDisplayRows / PAGE_SIZE) || 1);
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = totalDisplayRows === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const pageEnd = Math.min((safePage + 1) * PAGE_SIZE, totalDisplayRows);

  const paginatedRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, safePage]);

  useEffect(() => {
    setPage(0);
  }, [q, showUnlinkedOnly, showProductsWithoutRules]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  function openAddForProduct(p: ProductMasterListRow) {
    setForm({
      ...emptyForm,
      prod_code: p.code,
      prod_name: p.description,
    });
    setProductFilter('');
    setEditId(null);
    setModal('add');
    setError('');
    loadMasterProducts();
  }

  useEffect(() => {
    if (!modal) return;
    const t = setTimeout(() => loadMasterProducts(productFilter || undefined), 250);
    return () => clearTimeout(t);
  }, [modal, productFilter]);

  useEffect(() => {
    if (!modal) return;
    const onFocus = () => {
      void loadMasterProducts(productFilter || undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [modal, productFilter]);

  useEffect(() => {
    if (!modal || !form.prod_code) return;
    const p = masterProducts.find((x) => x.code === form.prod_code);
    if (!p) return;
    setForm((f) => (f.prod_name === p.description ? f : { ...f, prod_name: p.description }));
  }, [modal, form.prod_code, masterProducts]);

  const filteredMasterProducts = useMemo(() => {
    const needle = productFilter.trim().toLowerCase();
    if (!needle) return masterProducts;
    return masterProducts.filter(
      (p) =>
        p.code.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle)
    );
  }, [masterProducts, productFilter]);

  const selectedMaster = useMemo(
    () => masterProducts.find((p) => p.code === form.prod_code),
    [masterProducts, form.prod_code]
  );

  function openAdd() {
    setForm(emptyForm);
    setProductFilter('');
    setEditId(null);
    setModal('add');
    setError('');
    loadMasterProducts();
  }

  function openEdit(s: GradingStandard) {
    setForm({
      prod_code: s.prod_code,
      prod_name: s.master_description || s.prod_name,
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
    setProductFilter('');
    setEditId(s.id);
    setModal('edit');
    setError('');
    loadMasterProducts();
  }

  function onProductSelect(code: string) {
    const p = masterProducts.find((x) => x.code === code);
    if (!p) {
      setForm((f) => ({ ...f, prod_code: '', prod_name: '' }));
      return;
    }
    setForm((f) => ({
      ...f,
      prod_code: p.code,
      prod_name: p.description,
    }));
  }

  function onCostCenterChange(code: string) {
    const cc = costCenters.find((c) => c.code === code);
    setForm((f) => ({
      ...f,
      cost_center_code: code,
      cost_center_name: cc?.name || f.cost_center_name,
    }));
  }

  function goToProductMasterUpdate() {
    if (!form.prod_code) return;
    const url = `/product-master?code=${encodeURIComponent(form.prod_code)}&from=standards`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.prod_code) {
      setError('Select a product from Product Master');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { ...form, effective_date: form.effective_date || null };
      if (modal === 'add') await api.createStandard(body);
      else if (editId) await api.updateStandard(editId, body);
      setModal(null);
      load();
      void loadMasterProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: 'Delete grading rule',
      message: 'Delete this grading standard?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    await api.deleteStandard(id);
    load();
  }

  async function handleLinkProducts(createMissing: boolean) {
    setLinking(true);
    setLinkMessage('');
    try {
      const result = await api.linkGradingStandardsToProductMaster(createMissing);
      if (result.productsCreated > 0) {
        setLinkMessage(
          `Created ${result.productsCreated} product(s) in Product Master and linked ${result.rulesLinked} rule(s).`
        );
      } else if (result.rulesLinked > 0) {
        setLinkMessage(`Linked ${result.rulesLinked} rule(s) to Product Master.`);
      } else if (result.unlinkedRules === 0) {
        setLinkMessage('All grading rules are linked to Product Master.');
      } else {
        setLinkMessage(
          `${result.unlinkedRules} rule(s) still unlinked — add matching product codes in Product Master, then link again.`
        );
      }
      await loadMasterProducts();
      load();
    } catch (err) {
      setLinkMessage(err instanceof Error ? err.message : 'Link failed');
    } finally {
      setLinking(false);
    }
  }

  const unlinkedCount = standards.filter((s) => !s.in_product_master).length;
  const ruleCount = standards.length;
  const pmCount = masterProducts.length;
  const noRuleCount = productsWithoutRules.length;

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Grading rules</h2>
          <p className="text-slate-400 text-sm mt-1">
            Linked to{' '}
            <Link to="/product-master" className="text-amber-400 hover:underline">
              Product Master
            </Link>
            {' '}— {pmCount} product(s), {ruleCount} rule(s)
            {noRuleCount > 0 ? `, ${noRuleCount} awaiting work station rule` : ''}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm"
          >
            + Add grading rule
          </button>
        )}
      </header>

      {masterProducts.length === 0 && (
        <div className="mes-notice-amber mb-4 rounded-lg px-4 py-3 text-sm">
          No products in Product Master yet.{' '}
          <Link to="/product-master" className="font-semibold underline">
            Add products first
          </Link>
          , then create grading rules here.
        </div>
      )}

      {noRuleCount > 0 && !showUnlinkedOnly && showProductsWithoutRules && (
        <div className="mes-notice-sky mb-4 rounded-lg px-4 py-3 text-sm">
          {noRuleCount} product(s) from Product Master do not have a grading rule yet. They appear below
          as <span className="font-semibold">No rule yet</span> — use <span className="font-semibold">Add rule</span>{' '}
          to set work station and C/B/A/A+ thresholds.
        </div>
      )}

      {unlinkedCount > 0 && (
        <div className="mes-notice-rose mb-4 rounded-lg px-4 py-3 text-sm space-y-3">
          <p>
            {unlinkedCount} rule(s) use a product code that is not in Product Master. Link them by creating
            missing products from the rule codes, or edit each rule and re-select the product.
          </p>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={linking}
                onClick={() => void handleLinkProducts(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {linking ? 'Linking…' : 'Create missing products & link all'}
              </button>
              <button
                type="button"
                disabled={linking}
                onClick={() => void handleLinkProducts(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-xs disabled:opacity-50"
              >
                Link matching codes only
              </button>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 ml-1">
                <input
                  type="checkbox"
                  checked={showProductsWithoutRules}
                  onChange={(e) => setShowProductsWithoutRules(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Show products without rules
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 ml-1">
                <input
                  type="checkbox"
                  checked={showUnlinkedOnly}
                  onChange={(e) => setShowUnlinkedOnly(e.target.checked)}
                  className="rounded border-slate-600"
                />
                Show unlinked rules only
              </label>
            </div>
          )}
        </div>
      )}

      {linkMessage && (
        <div className="mes-notice-emerald mb-4 rounded-lg px-4 py-3 text-sm">
          {linkMessage}
        </div>
      )}

      <input
        placeholder="Search product code, name, or work station..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full max-w-md xl:max-w-xl bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 mb-6"
      />

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[22%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[9%]" />
            {canWrite && <col className="w-[14%]" />}
          </colgroup>
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="p-2 text-left align-bottom">Product Master</th>
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
            {paginatedRows.length === 0 && displayRows.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="p-8 text-center text-slate-500">
                  {pmCount === 0
                    ? 'No products in Product Master. Import or add products first.'
                    : 'No matching products or rules. Try another search or turn on “Show products without rules”.'}
                </td>
              </tr>
            )}
            {paginatedRows.map((row) =>
              row.kind === 'rule' ? (
                <tr key={`rule-${row.rule.id}`} className="border-t border-slate-800 hover:bg-slate-900/40">
                  <td className="p-2 align-top">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Code</p>
                    <span className="mes-prod-code font-mono text-sm font-semibold text-foreground">{row.rule.prod_code}</span>
                    {!row.rule.in_product_master && (
                      <span className="ml-1 text-[10px] uppercase text-rose-400 font-semibold">Unlinked</span>
                    )}
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5 mb-0.5">Description</p>
                    <p className="text-foreground truncate">{row.rule.master_description || row.rule.prod_name}</p>
                    {row.rule.master_base_uom && (
                      <p className="text-[10px] text-muted-foreground mt-1">UOM: {row.rule.master_base_uom}</p>
                    )}
                  </td>
                  <td className="p-2 align-top">
                    <span className="font-mono font-medium text-foreground">{row.rule.cost_center_code}</span>
                    <p className="text-muted-foreground truncate">{row.rule.cost_center_name}</p>
                  </td>
                  <td className="p-2 text-right align-top font-medium tabular-nums">{row.rule.std_qty}</td>
                  <td className="p-2 text-right align-top text-red-400/80 tabular-nums">{row.rule.c_value}</td>
                  <td className="p-2 text-right align-top text-orange-400/80 tabular-nums">{row.rule.b_value}</td>
                  <td className="p-2 text-right align-top text-emerald-400/80 tabular-nums">{row.rule.a_value}</td>
                  <td className="p-2 text-right align-top text-amber-400/80 tabular-nums">{row.rule.aplus_value}</td>
                  <td className="p-2 text-left align-top text-slate-500 whitespace-nowrap tabular-nums">
                    {row.rule.effective_date || '—'}
                  </td>
                  {canWrite && (
                    <td className="p-2 align-top whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row.rule)}
                        className="text-primary hover:underline mr-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.rule.id)}
                        className="text-red-400 hover:underline"
                      >
                        Del
                      </button>
                    </td>
                  )}
                </tr>
              ) : (
                <tr
                  key={`product-${row.product.id}`}
                  className="border-t border-slate-800 bg-slate-900/25 hover:bg-slate-900/50"
                >
                  <td className="p-2 align-top">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Code</p>
                    <span className="mes-prod-code font-mono text-sm font-semibold text-foreground">{row.product.code}</span>
                    <span className="ml-1 text-[10px] uppercase text-sky-400 font-semibold">No rule yet</span>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5 mb-0.5">Description</p>
                    <p className="text-foreground truncate">{row.product.description}</p>
                    {row.product.base_uom && (
                      <p className="text-[10px] text-muted-foreground mt-1">UOM: {row.product.base_uom}</p>
                    )}
                  </td>
                  <td className="p-2 align-top text-slate-500" colSpan={canWrite ? 7 : 6}>
                    <span className="italic">Add a work station rule for this product</span>
                  </td>
                  {canWrite && (
                    <td className="p-2 align-top whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openAddForProduct(row.product)}
                        className="text-emerald-400 hover:underline font-medium"
                      >
                        Add rule
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {totalDisplayRows > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-slate-500">
            Showing {pageStart}–{pageEnd} of {totalDisplayRows}
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

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSave}
            className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 pt-12 w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4"
          >
            <ModalCloseButton
              onClick={() => setModal(null)}
              className="absolute right-4 top-4 z-10"
            />
            <div>
              <h3 className="font-semibold text-lg pr-10">{modal === 'add' ? 'Add' : 'Edit'} grading rule</h3>
              <p className="text-xs text-slate-500 mt-1">
                Code and description come from{' '}
                <Link to="/product-master" className="text-amber-400 hover:underline">
                  Product Master
                </Link>
                . Updating the master record updates what appears here on save.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400">Filter products</label>
              <input
                type="search"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="Search code or description…"
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 items-end">
              <div>
                <label className="text-xs text-slate-400">Code *</label>
                <select
                  value={form.prod_code}
                  onChange={(e) => onProductSelect(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
                  required
                >
                  <option value="">Select from Product Master…</option>
                  {filteredMasterProducts.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Description *"
                value={form.prod_name}
                onChange={() => {}}
                readOnly
              />
            </div>

            {selectedMaster && (
              <p className="text-xs text-slate-500 -mt-1">
                Master: {selectedMaster.base_uom || '—'} UOM · {selectedMaster.type || '—'} ·{' '}
                {selectedMaster.product_nature || '—'}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 items-end">
              <div>
                <label className="text-xs text-slate-400">Work station *</label>
                <select
                  value={form.cost_center_code}
                  onChange={(e) => onCostCenterChange(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select…</option>
                  {costCenters.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Effective date"
                value={form.effective_date || ''}
                onChange={(v) => setForm({ ...form, effective_date: v })}
                type="date"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
              <p className="text-xs text-sky-950 leading-relaxed">
                UOM, stock, accounts, tax, and other fields live in Product Master for this code. Opens
                in a new tab — this grading form stays open here.
              </p>
              <button
                type="button"
                disabled={!form.prod_code}
                onClick={goToProductMasterUpdate}
                className="shrink-0 text-sm font-semibold text-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  form.prod_code
                    ? `Open ${form.prod_code} in Product Master (new tab)`
                    : 'Select a product code first'
                }
              >
                + More Update
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">Grade thresholds</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <NumField label="Std Qty (B)" value={form.std_qty} onChange={(v) => setForm({ ...form, std_qty: v })} />
                <NumField
                  label="Standard min"
                  value={form.standard_min ?? 420}
                  onChange={(v) => setForm({ ...form, standard_min: v })}
                />
                <NumField label="C value" value={form.c_value} onChange={(v) => setForm({ ...form, c_value: v })} />
                <NumField label="B value" value={form.b_value} onChange={(v) => setForm({ ...form, b_value: v })} />
                <NumField label="A value" value={form.a_value} onChange={(v) => setForm({ ...form, a_value: v })} />
                <NumField
                  label="A+ value"
                  value={form.aplus_value}
                  onChange={(v) => setForm({ ...form, aplus_value: v })}
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 pt-1 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-700"
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm ${readOnly ? 'opacity-70 cursor-not-allowed text-slate-300' : ''}`}
        required={!readOnly && type !== 'date'}
      />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={Number.isFinite(value) ? String(value) : '0'}
        onChange={(e) => {
          const raw = sanitizeNonNegativeDecimalInput(e.target.value);
          if (!raw) {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
        onKeyDown={blockNegativeNumberKey}
        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        required
      />
    </div>
  );
}
