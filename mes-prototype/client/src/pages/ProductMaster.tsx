import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, downloadBlob } from '../api';
import type {
  ProductAccountMappingRowInput,
  ProductExciseMappingRowInput,
  ProductMaster,
  ProductMasterInput,
  ProductMasterSaveInput,
  VatCategory,
} from '../api';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import {
  asNonNegativeNumberOrUndef,
  blockNegativeNumberKey,
  sanitizeNonNegativeDecimalInput,
} from '../utils/numericInput';

const UOMS = ['pcs', 'box', 'kg', 'g', 'mg', 'L', 'mL'] as const;
const UOM_CUSTOM = '__custom__';
const UOM_MAX_LEN = 10;
const TYPES = ['Stock', 'Service'] as const;
const PRODUCT_TYPES = ['TradingGoods', 'FinishedGoods', 'FixedAssets', 'ConsumableGoods'] as const;
const PRODUCT_NATURES = ['Normal', 'FinishedGood', 'RawMaterial'] as const;

const VAT_OPTIONS: { value: VatCategory; label: string; taxPercent: number | null }[] = [
  { value: 'standard_13', label: 'Standard (13%)', taxPercent: 13 },
  { value: 'zero_0', label: 'Zero-rated (0%)', taxPercent: 0 },
  { value: 'exempt', label: 'Exempt (Schedule-1)', taxPercent: null },
];

const CODE_MAX = 35;
const inputSm = 'input input-sm w-full';
const btnSm = 'btn-sm';

function PmLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] font-medium text-slate-500 mb-0.5 leading-none">{children}</span>;
}

function PmField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`inline-flex flex-col align-top ${className}`}>
      <PmLabel>{label}</PmLabel>
      {children}
    </label>
  );
}

function uomSelectValue(stored: string | undefined | null, allowEmpty: boolean): string {
  const u = (stored || '').trim();
  if (!u) return allowEmpty ? '' : UOM_CUSTOM;
  if ((UOMS as readonly string[]).includes(u)) return u;
  return UOM_CUSTOM;
}

function pmNumericFromEvent(e: React.ChangeEvent<HTMLInputElement>): number | undefined {
  return asNonNegativeNumberOrUndef(sanitizeNonNegativeDecimalInput(e.target.value));
}

function PmUomField({
  label,
  value,
  onChange,
  quantity,
  onQuantityChange,
  allowEmpty = false,
  className = 'w-[5.5rem]',
}: {
  label: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  quantity?: number;
  onQuantityChange?: (next: number | undefined) => void;
  allowEmpty?: boolean;
  className?: string;
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [popupError, setPopupError] = useState('');
  const revertSelect = useRef(allowEmpty ? '' : 'pcs');

  const selectVal = uomSelectValue(value, allowEmpty);
  const isCustom = selectVal === UOM_CUSTOM;
  const customDisplay = (value || '').trim();

  useEffect(() => {
    if (selectVal !== UOM_CUSTOM) revertSelect.current = selectVal;
  }, [selectVal]);

  function openCustomPopup(name: string, qty?: number) {
    setDraftName(name);
    setDraftQty(qty != null && Number.isFinite(qty) && qty >= 0 ? String(qty) : '');
    setPopupError('');
    setPopupOpen(true);
  }

  function confirmCustom() {
    const name = draftName.trim().slice(0, UOM_MAX_LEN);
    const qtyStr = draftQty.trim();
    if (!name && !allowEmpty) {
      setPopupError('Name is required (max 10 characters)');
      return;
    }
    if (!name && allowEmpty) {
      onChange(undefined);
      onQuantityChange?.(undefined);
      setPopupOpen(false);
      return;
    }
    if (onQuantityChange) {
      if (!qtyStr) {
        setPopupError('Quantity is required');
        return;
      }
      const qty = Number(qtyStr);
      if (!Number.isFinite(qty) || qty < 0) {
        setPopupError('Quantity cannot be negative');
        return;
      }
      onQuantityChange(qty);
    }
    onChange(name);
    setPopupOpen(false);
  }

  function cancelCustom() {
    setPopupOpen(false);
    setPopupError('');
    if (!customDisplay || (UOMS as readonly string[]).includes(customDisplay)) {
      const r = revertSelect.current;
      onChange(r ? r : allowEmpty ? undefined : 'pcs');
    }
  }

  const customSummary =
    isCustom && customDisplay
      ? quantity != null && Number.isFinite(quantity)
        ? `${customDisplay} (${quantity})`
        : customDisplay
      : '';

  return (
    <>
      <PmField label={label} className={className}>
        <div className="flex items-center gap-1 min-w-0">
          <select
            className={`${inputSm} flex-1 min-w-0`}
            value={selectVal}
            onChange={(e) => {
              const v = e.target.value;
              if (v === UOM_CUSTOM) {
                openCustomPopup(
                  customDisplay && !(UOMS as readonly string[]).includes(customDisplay)
                    ? customDisplay
                    : '',
                  quantity
                );
              } else if (v === '') {
                onChange(undefined);
                onQuantityChange?.(undefined);
              } else {
                onChange(v);
              }
            }}
          >
            {allowEmpty && <option value="">—</option>}
            {UOMS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            <option value={UOM_CUSTOM}>
              {customSummary ? `Other: ${customSummary}` : 'Other (custom)…'}
            </option>
          </select>
          {isCustom && customDisplay && (
            <button
              type="button"
              className="shrink-0 text-[10px] text-amber-400/90 hover:text-amber-300 underline leading-none"
              title={`Edit custom ${label}`}
              onClick={() => openCustomPopup(customDisplay, quantity)}
            >
              Edit
            </button>
          )}
        </div>
      </PmField>

      {popupOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="uom-popup-title"
          onClick={cancelCustom}
        >
          <div
            className="w-full max-w-[17rem] rounded-lg border border-slate-700 bg-slate-900 p-3.5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="uom-popup-title" className="text-sm font-semibold text-slate-100">
              Custom UOM
            </h4>

            <div className="mt-3 space-y-2.5">
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <label className="text-[11px] font-medium text-slate-400">Name</label>
                  <span className="text-[10px] text-slate-500">upto {UOM_MAX_LEN} character</span>
                </div>
                <input
                  className={inputSm}
                  value={draftName}
                  maxLength={UOM_MAX_LEN}
                  placeholder="e.g. pair, set"
                  autoFocus
                  onChange={(e) => {
                    setDraftName(e.target.value.slice(0, UOM_MAX_LEN));
                    setPopupError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmCustom();
                    }
                    if (e.key === 'Escape') cancelCustom();
                  }}
                />
              </div>

              {onQuantityChange && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-0.5">Quantity</label>
                  <input
                    className={inputSm}
                    type="text"
                    inputMode="decimal"
                    value={draftQty}
                    placeholder="e.g. 1, 12"
                    onChange={(e) => {
                      setDraftQty(sanitizeNonNegativeDecimalInput(e.target.value));
                      setPopupError('');
                    }}
                    onKeyDown={(e) => {
                      blockNegativeNumberKey(e);
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmCustom();
                      }
                      if (e.key === 'Escape') cancelCustom();
                    }}
                  />
                </div>
              )}
            </div>

            {popupError && <p className="mt-2 text-[10px] text-rose-300">{popupError}</p>}

            <div className="mt-3 flex justify-end gap-1.5">
              <button type="button" className={btnSm} onClick={cancelCustom}>
                Cancel
              </button>
              <button
                type="button"
                className={`${btnSm} border-amber-500/40 bg-amber-500/15 text-amber-100`}
                onClick={confirmCustom}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const emptyProduct: ProductMasterInput = {
  code: '',
  description: '',
  base_uom: 'pcs',
  type: 'Stock',
  product_type: 'TradingGoods',
  product_nature: 'Normal',
  vat_category: 'standard_13',
  hs_code: '',
  buy_price: undefined,
  buy_disc_pct: undefined,
  sales_price: undefined,
  sales_disc_pct: undefined,
  mrp: undefined,
  warranty_rate: undefined,
  product_harmonic: '',
  double_qty: false,
  alt_uom: '',
  fix_conversion: false,
  base_value: undefined,
  alt_value: undefined,
  location: '',
  alternative_code: '',
  max_stock: undefined,
  min_stock: undefined,
  reorder_level: undefined,
  additional_desc_change: false,
  additional_desc1: '',
  additional_desc2: '',
  additional_desc3: '',
  additional_desc4: '',
  additional_desc5: '',
};

const ADDITIONAL_DESC_MAX = 5;
const ADDITIONAL_DESC_START = 2;

function additionalDescSlotsUsed(p: ProductMasterInput): number {
  for (let n = ADDITIONAL_DESC_MAX; n >= 1; n--) {
    const key = `additional_desc${n}` as keyof ProductMasterInput;
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return n;
  }
  return ADDITIONAL_DESC_START;
}

export default function ProductMasterPage() {
  const { can } = useAuth();
  const canWrite = can('standards:write');
  const location = useLocation();
  const fromStandards = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('from') === 'standards';
  }, [location.search]);
  const deepLinkCode = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('code')?.trim() || '';
  }, [location.search]);

  const [q, setQ] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [list, setList] = useState<{ id: number; code: string; description: string }[]>([]);
  const [total, setTotal] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<'csv' | 'pdf' | null>(null);

  const [product, setProduct] = useState<ProductMasterInput>(emptyProduct);
  const [accountRows, setAccountRows] = useState<ProductAccountMappingRowInput[]>([
    {
      group_name: '',
      subgroup_name: '',
      sales_account: '',
      sales_return_account: '',
      purchase_account: '',
      purchase_return_account: '',
      opening_stock_account: '',
      closing_stock_pl_account: '',
      stock_in_hand_account: '',
    },
  ]);
  const [exciseRows, setExciseRows] = useState<ProductExciseMappingRowInput[]>([
    { excise_code: '', rate: undefined, notes: '' },
  ]);
  const [visibleDescCount, setVisibleDescCount] = useState(ADDITIONAL_DESC_START);

  const vatMeta = useMemo(
    () => VAT_OPTIONS.find((v) => v.value === product.vat_category) || VAT_OPTIONS[0],
    [product.vat_category]
  );

  const loadListRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const loadDetailRef = useRef<(id: number) => Promise<void>>(() => Promise.resolve());

  function resetToAdd() {
    setSelectedId(null);
    setProduct(emptyProduct);
    setAccountRows([
      {
        group_name: '',
        subgroup_name: '',
        sales_account: '',
        sales_return_account: '',
        purchase_account: '',
        purchase_return_account: '',
        opening_stock_account: '',
        closing_stock_pl_account: '',
        stock_in_hand_account: '',
      },
    ]);
    setExciseRows([{ excise_code: '', rate: undefined, notes: '' }]);
    setVisibleDescCount(ADDITIONAL_DESC_START);
    setError('');
    setSuccess('');
  }

  async function loadList() {
    setLoadingList(true);
    try {
      const needle = q.trim();
      const r = await api.productMasterList({ q: needle || undefined, offset: 0, limit: 100 });
      const rows = r.rows.map((x) => ({ id: x.id, code: x.code, description: x.description }));
      setList(rows);
      setTotal(r.total);
      if (needle && r.total === 1 && rows.length === 1 && selectedId !== rows[0].id) {
        await loadDetailRef.current(rows[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load list');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(id: number) {
    setLoadingDetail(true);
    try {
      const d = await api.productMasterDetail(id);
      setSelectedId(id);
      const loadedProduct: ProductMasterInput = {
        ...emptyProduct,
        ...(d.product as ProductMaster),
        double_qty: !!d.product.double_qty,
        fix_conversion: !!d.product.fix_conversion,
        additional_desc_change: !!d.product.additional_desc_change,
        hs_code: d.product.hs_code || '',
        product_harmonic: d.product.product_harmonic || '',
        alt_uom: d.product.alt_uom || '',
        location: d.product.location || '',
        alternative_code: d.product.alternative_code || '',
        additional_desc1: d.product.additional_desc1 || '',
        additional_desc2: d.product.additional_desc2 || '',
        additional_desc3: d.product.additional_desc3 || '',
        additional_desc4: d.product.additional_desc4 || '',
        additional_desc5: d.product.additional_desc5 || '',
      };
      setProduct(loadedProduct);
      setVisibleDescCount(
        Math.max(ADDITIONAL_DESC_START, additionalDescSlotsUsed(loadedProduct))
      );
      setAccountRows(
        d.accountMapping.length
          ? d.accountMapping.map((r) => ({
              group_name: r.group_name || '',
              subgroup_name: r.subgroup_name || '',
              sales_account: r.sales_account || '',
              sales_return_account: r.sales_return_account || '',
              purchase_account: r.purchase_account || '',
              purchase_return_account: r.purchase_return_account || '',
              opening_stock_account: r.opening_stock_account || '',
              closing_stock_pl_account: r.closing_stock_pl_account || '',
              stock_in_hand_account: r.stock_in_hand_account || '',
            }))
          : [
              {
                group_name: '',
                subgroup_name: '',
                sales_account: '',
                sales_return_account: '',
                purchase_account: '',
                purchase_return_account: '',
                opening_stock_account: '',
                closing_stock_pl_account: '',
                stock_in_hand_account: '',
              },
            ]
      );
      setExciseRows(
        d.exciseMappings.length
          ? d.exciseMappings.map((r) => ({
              excise_code: r.excise_code || '',
              rate: r.rate ?? undefined,
              notes: r.notes || '',
            }))
          : [{ excise_code: '', rate: undefined, notes: '' }]
      );
      setError('');
      setSuccess('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load product');
    } finally {
      setLoadingDetail(false);
    }
  }

  loadListRef.current = loadList;
  loadDetailRef.current = loadDetail;

  useEffect(() => {
    void loadListRef.current();
  }, []);

  useEffect(() => {
    if (!deepLinkCode) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await api.productMasterList({ q: deepLinkCode, limit: 100 });
        if (cancelled) return;
        const match = r.rows.find((p) => p.code === deepLinkCode) ?? r.rows[0];
        if (match) {
          await loadDetailRef.current(match.id);
        } else {
          setError(`Product "${deepLinkCode}" not found in Product Master.`);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to open product');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deepLinkCode]);

  useEffect(() => {
    const t = setTimeout(() => void loadListRef.current(), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function saveAll() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body: ProductMasterInput = {
        ...product,
        code: product.code.trim(),
        description: product.description.trim(),
        hs_code: product.hs_code?.trim() || undefined,
        product_harmonic: product.product_harmonic?.trim() || undefined,
        alt_uom: product.alt_uom?.trim() || undefined,
        location: product.location?.trim() || undefined,
        alternative_code: product.alternative_code?.trim() || undefined,
        additional_desc1: product.additional_desc1?.trim() || undefined,
        additional_desc2: product.additional_desc2?.trim() || undefined,
        additional_desc3: product.additional_desc3?.trim() || undefined,
        additional_desc4: product.additional_desc4?.trim() || undefined,
        additional_desc5: product.additional_desc5?.trim() || undefined,
      };
      if (!body.code) throw new Error('Code is required');
      if (body.code.length > CODE_MAX) throw new Error(`Code must be at most ${CODE_MAX} characters`);
      if (!body.description) throw new Error('Description is required');
      const baseUom = body.base_uom?.trim();
      if (!baseUom) throw new Error('UOM is required — pick a standard unit or enter a custom one');
      if (baseUom.length > UOM_MAX_LEN) throw new Error(`UOM must be at most ${UOM_MAX_LEN} characters`);
      body.base_uom = baseUom;
      if (body.alt_uom && body.alt_uom.length > UOM_MAX_LEN) {
        throw new Error(`Alt UOM must be at most ${UOM_MAX_LEN} characters`);
      }

      const payload: ProductMasterSaveInput = {
        ...body,
        accountMapping: accountRows
          .filter((r) => Object.values(r).some((v) => String(v || '').trim()))
          .map((r) => ({
            ...r,
            group_name: r.group_name?.trim() || undefined,
            subgroup_name: r.subgroup_name?.trim() || undefined,
            sales_account: r.sales_account?.trim() || undefined,
            sales_return_account: r.sales_return_account?.trim() || undefined,
            purchase_account: r.purchase_account?.trim() || undefined,
            purchase_return_account: r.purchase_return_account?.trim() || undefined,
            opening_stock_account: r.opening_stock_account?.trim() || undefined,
            closing_stock_pl_account: r.closing_stock_pl_account?.trim() || undefined,
            stock_in_hand_account: r.stock_in_hand_account?.trim() || undefined,
          })),
        exciseMappings: exciseRows
          .filter((r) => (r.excise_code && r.excise_code.trim()) || r.rate != null || (r.notes && r.notes.trim()))
          .map((r) => ({
            excise_code: r.excise_code?.trim() || undefined,
            rate: r.rate,
            notes: r.notes?.trim() || undefined,
          })),
      };

      const saved = selectedId
        ? await api.updateProductMaster(selectedId, payload)
        : await api.createProductMaster(payload);

      setSuccess(selectedId ? 'Updated.' : 'Created.');
      await loadList();
      await loadDetail(saved.product.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const editingLabel = selectedId
    ? list.find((p) => p.id === selectedId)?.code || product.code || 'Product'
    : product.code?.trim() || 'New product';

  const exportBaseName = useMemo(() => {
    const code = (product.code || 'product').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'product';
    return `product-${code}`;
  }, [product.code]);

  const productTypeOptions = useMemo(() => {
    const cur = product.product_type?.trim();
    if (cur && !(PRODUCT_TYPES as readonly string[]).includes(cur)) {
      return [cur, ...PRODUCT_TYPES];
    }
    return [...PRODUCT_TYPES];
  }, [product.product_type]);

  function printProduct() {
    setExportOpen(false);
    window.print();
  }

  async function exportCsv() {
    if (!selectedId) {
      setError('Save the product first to export CSV.');
      return;
    }
    setExportBusy('csv');
    try {
      const blob = await api.exportProductMasterCsv(selectedId);
      downloadBlob(blob, `${exportBaseName}.csv`);
      setExportOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV export failed');
    } finally {
      setExportBusy(null);
    }
  }

  async function exportPdf() {
    if (!selectedId) {
      setError('Save the product first to export PDF.');
      return;
    }
    setExportBusy('pdf');
    try {
      const blob = await api.exportProductMasterPdf(selectedId);
      downloadBlob(blob, `${exportBaseName}.pdf`);
      setExportOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="mes-page flex flex-col w-full min-h-0 max-w-[96rem] mx-auto px-2 md:px-4 py-1 pb-28 md:pb-16 print:p-0 print:pb-0">
      <div className="sticky top-0 z-30 shrink-0 border-b border-slate-800 bg-slate-950 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight">Product Master</h1>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
              <span className="text-slate-400">Editing:</span>{' '}
              <span className="text-slate-300">{editingLabel}</span>
              {loadingDetail ? ' · …' : null}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className={btnSm} type="button" onClick={resetToAdd} title="Clear form for a new product">
              Add new
            </button>
            <button
              className={`${btnSm} border-amber-500/40 bg-amber-500/15 text-amber-100`}
              type="button"
              onClick={saveAll}
              disabled={!canWrite || saving}
            >
              {saving ? '…' : selectedId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>

        {fromStandards && product.code && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
            <span>
              Complete remaining Product Master details for{' '}
              <span className="font-mono font-semibold">{product.code}</span> — grading rules use code
              &amp; description from here. You can close this tab when done; grading rules stay open in
              the other tab.
            </span>
            <Link to="/standards" className="shrink-0 font-semibold underline hover:text-white">
              Open grading rules
            </Link>
          </div>
        )}

        <div className="pm-toolbar">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span className="pm-toolbar-label">Open</span>
            <select
              className="pm-toolbar-field"
              value={selectedId ?? ''}
              title="Pick a saved product to edit, or + New product for a blank form"
              onChange={(e) => {
                const v = e.target.value;
                if (!v) resetToAdd();
                else void loadDetail(Number(v));
              }}
            >
              <option value="">+ New product</option>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.description}
                </option>
              ))}
            </select>
            <span className="pm-toolbar-meta">{total} saved</span>

            <span className="hidden sm:block w-px h-4 bg-slate-700 shrink-0" aria-hidden />

            <span className="pm-toolbar-label">Find</span>
            <input
              className="pm-toolbar-field"
              placeholder="Code, description, HS, alt code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadList()}
              aria-label="Find by code, description, HS code, or alternative code"
            />
            <button
              type="button"
              className="pm-toolbar-link inline-flex items-center gap-1"
              onClick={loadList}
              disabled={loadingList}
            >
              {loadingList ? <Spinner className="h-3 w-3" /> : null}
              search
            </button>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className="mt-1 px-1">
          {error && (
            <div className="rounded border border-rose-500/30 bg-rose-500/10 text-rose-100 px-2 py-1 text-xs">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 px-2 py-1 text-xs">
              {success}
            </div>
          )}
        </div>
      )}

      <div id="pm-print-area">
        <div className="hidden print:block mb-3 border-b border-slate-300 pb-2">
          <h1 className="text-base font-bold text-black">Product Master</h1>
          <p className="text-sm text-slate-700 mt-0.5">{editingLabel}</p>
        </div>

        <div
          className="mt-2 space-y-2 overflow-y-auto flex-1 min-h-0 print:overflow-visible"
          id="pm-form"
          onKeyDown={(e) => {
            if (e.target instanceof HTMLInputElement && e.target.inputMode === 'decimal') {
              blockNegativeNumberKey(e);
            }
          }}
        >
          <div className="pm-section print:break-inside-avoid" id="pm-basic">
            <div className="flex items-center justify-between gap-2">
              <h2 className="pm-section-title mb-0 border-0 pb-0">Basic information (ADD)</h2>
              {loadingDetail && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1 print:hidden">
                  <Spinner className="h-3 w-3" /> Loading
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 mt-1">
              <PmField label="Code" className="w-[35ch] max-w-full shrink-0">
                <input
                  className={`${inputSm} font-mono`}
                  maxLength={CODE_MAX}
                  value={product.code}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, code: e.target.value.slice(0, CODE_MAX) }))
                  }
                />
              </PmField>
              <PmField label="Description" className="flex-1 min-w-[14rem] max-w-2xl">
                <input
                  className={inputSm}
                  value={product.description}
                  onChange={(e) => setProduct((v) => ({ ...v, description: e.target.value }))}
                />
              </PmField>
              <PmUomField
                label="UOM"
                value={product.base_uom ?? undefined}
                onChange={(base_uom) => setProduct((v) => ({ ...v, base_uom: base_uom || '' }))}
                quantity={product.base_value ?? undefined}
                onQuantityChange={(base_value) => setProduct((v) => ({ ...v, base_value }))}
              />
              <PmField label="Type" className="w-[6.5rem]">
                <select
                  className={inputSm}
                  value={product.type || ''}
                  onChange={(e) => setProduct((v) => ({ ...v, type: e.target.value }))}
                >
                  {TYPES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </PmField>
              <PmField label="Prod. type" className="w-[8.5rem]">
                <select
                  className={inputSm}
                  value={product.product_type || ''}
                  onChange={(e) => setProduct((v) => ({ ...v, product_type: e.target.value }))}
                >
                  {productTypeOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </PmField>
              <PmField label="Nature" className="w-[8rem]">
                <select
                  className={inputSm}
                  value={product.product_nature || ''}
                  onChange={(e) => setProduct((v) => ({ ...v, product_nature: e.target.value }))}
                >
                  {PRODUCT_NATURES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </PmField>
              <PmField label="VAT (Nepal)" className="w-[11rem]">
                <select
                  className={inputSm}
                  value={product.vat_category}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, vat_category: e.target.value as VatCategory }))
                  }
                >
                  {VAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </PmField>
              <PmField label="Tax %" className="w-[3.5rem]">
                <input
                  className={`${inputSm} text-center`}
                  value={vatMeta.taxPercent == null ? '' : String(vatMeta.taxPercent)}
                  disabled
                />
              </PmField>
              <PmField label="HS code" className="w-[8rem]">
                <input
                  className={inputSm}
                  value={product.hs_code || ''}
                  onChange={(e) => setProduct((v) => ({ ...v, hs_code: e.target.value }))}
                />
              </PmField>
              <PmField label="Buy" className="w-[5.5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.buy_price ?? ''}
                  onChange={(e) => setProduct((v) => ({ ...v, buy_price: pmNumericFromEvent(e) }))}
                />
              </PmField>
              <PmField label="Buy disc%" className="w-[4.5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.buy_disc_pct ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, buy_disc_pct: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Sales" className="w-[5.5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.sales_price ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, sales_price: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Sal disc%" className="w-[4.5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.sales_disc_pct ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, sales_disc_pct: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="MRP" className="w-[5.5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.mrp ?? ''}
                  onChange={(e) => setProduct((v) => ({ ...v, mrp: pmNumericFromEvent(e) }))}
                />
              </PmField>
              <PmField label="Warranty" className="w-[5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.warranty_rate ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, warranty_rate: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Harmonic" className="w-[10rem]">
                <input
                  className={inputSm}
                  value={product.product_harmonic || ''}
                  onChange={(e) => setProduct((v) => ({ ...v, product_harmonic: e.target.value }))}
                />
              </PmField>
            </div>
          </div>

          <div className="pm-section print:break-inside-avoid" id="pm-stock">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1 mb-2 min-h-[1.5rem]">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80 shrink-0">
                Stock information
              </h2>
              <div className="flex-1 flex justify-center items-center gap-4 flex-wrap px-2">
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={!!product.double_qty}
                    onChange={(e) => setProduct((v) => ({ ...v, double_qty: e.target.checked }))}
                  />
                  Double qty
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={!!product.fix_conversion}
                    onChange={(e) => setProduct((v) => ({ ...v, fix_conversion: e.target.checked }))}
                  />
                  Fix conv.
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={!!product.additional_desc_change}
                    onChange={(e) =>
                      setProduct((v) => ({ ...v, additional_desc_change: e.target.checked }))
                    }
                  />
                  Add. desc chg
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
              <PmUomField
                label="Alt UOM"
                allowEmpty
                value={product.alt_uom || undefined}
                onChange={(alt_uom) => setProduct((v) => ({ ...v, alt_uom: alt_uom || '' }))}
                quantity={product.alt_value ?? undefined}
                onQuantityChange={(alt_value) => setProduct((v) => ({ ...v, alt_value }))}
              />
              <PmField label="Base val" className="w-[5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.base_value ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, base_value: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Alt val" className="w-[5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.alt_value ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, alt_value: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Location" className="w-[8rem]">
                <input
                  className={inputSm}
                  value={product.location || ''}
                  onChange={(e) => setProduct((v) => ({ ...v, location: e.target.value }))}
                />
              </PmField>
              <PmField label="Alt code" className="shrink-0 w-[35ch]">
                <input
                  className={`${inputSm} font-mono`}
                  maxLength={CODE_MAX}
                  value={product.alternative_code || ''}
                  onChange={(e) =>
                    setProduct((v) => ({
                      ...v,
                      alternative_code: e.target.value.slice(0, CODE_MAX),
                    }))
                  }
                />
              </PmField>
              <PmField label="Max" className="w-[5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.max_stock ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, max_stock: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Min" className="w-[5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.min_stock ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, min_stock: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
              <PmField label="Reorder" className="w-[5rem]">
                <input
                  className={inputSm}
                  inputMode="decimal"
                  value={product.reorder_level ?? ''}
                  onChange={(e) =>
                    setProduct((v) => ({ ...v, reorder_level: pmNumericFromEvent(e) }))
                  }
                />
              </PmField>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 w-full max-w-xs">
              <PmField label="Add. desc">
                <div className="flex flex-col gap-1">
                  {Array.from({ length: visibleDescCount }, (_, i) => i + 1).map((n) => {
                    const key = `additional_desc${n}` as keyof ProductMasterInput;
                    return (
                      <input
                        key={n}
                        className={`${inputSm} w-full`}
                        placeholder={`Description ${n}`}
                        value={(product[key] as string) || ''}
                        onChange={(e) => setProduct((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    );
                  })}
                  {visibleDescCount < ADDITIONAL_DESC_MAX && (
                    <button
                      type="button"
                      className={`${btnSm} self-start mt-0.5`}
                      onClick={() =>
                        setVisibleDescCount((c) => Math.min(ADDITIONAL_DESC_MAX, c + 1))
                      }
                    >
                      + Add new description
                    </button>
                  )}
                </div>
              </PmField>
            </div>
          </div>

          <div className="pm-section print:break-inside-avoid" id="pm-accounts">
            <div className="flex items-center justify-between gap-2">
              <h2 className="pm-section-title mb-0 border-0 pb-0">Account mapping</h2>
              <button
                className={btnSm}
                onClick={() =>
                  setAccountRows((rows) => [
                    ...rows,
                    {
                      group_name: '',
                      subgroup_name: '',
                      sales_account: '',
                      sales_return_account: '',
                      purchase_account: '',
                      purchase_return_account: '',
                      opening_stock_account: '',
                      closing_stock_pl_account: '',
                      stock_in_hand_account: '',
                    },
                  ])
                }
              >
                + Row
              </button>
            </div>

            <div className="mt-1 overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="whitespace-nowrap px-1 py-0.5">Group</th>
                    <th className="whitespace-nowrap px-1 py-0.5">Sub</th>
                    <th className="whitespace-nowrap px-1 py-0.5">Sales</th>
                    <th className="whitespace-nowrap px-1 py-0.5">S.ret</th>
                    <th className="whitespace-nowrap px-1 py-0.5">Purch</th>
                    <th className="whitespace-nowrap px-1 py-0.5">P.ret</th>
                    <th className="whitespace-nowrap px-1 py-0.5">Op.stk</th>
                    <th className="whitespace-nowrap px-1 py-0.5">Cl.P/L</th>
                    <th className="whitespace-nowrap px-1 py-0.5">Stk hand</th>
                    <th className="px-1 py-0.5" />
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((r, idx) => (
                    <tr key={idx}>
                      {(
                        [
                          'group_name',
                          'subgroup_name',
                          'sales_account',
                          'sales_return_account',
                          'purchase_account',
                          'purchase_return_account',
                          'opening_stock_account',
                          'closing_stock_pl_account',
                          'stock_in_hand_account',
                        ] as const
                      ).map((k) => (
                        <td key={k} className="px-1 py-0.5">
                          <input
                            className={`${inputSm} w-[7.5rem]`}
                            value={(r[k] as string) || ''}
                            onChange={(e) =>
                              setAccountRows((rows) => {
                                const next = [...rows];
                                next[idx] = { ...next[idx], [k]: e.target.value };
                                return next;
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="px-1 py-0.5">
                        <button
                          className={btnSm}
                          type="button"
                          onClick={() => setAccountRows((rows) => rows.filter((_, i) => i !== idx))}
                          disabled={accountRows.length <= 1}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pm-section print:break-inside-avoid" id="pm-excise">
            <div className="flex items-center justify-between gap-2">
              <h2 className="pm-section-title mb-0 border-0 pb-0">Excise duty mapping</h2>
              <button
                className={btnSm}
                type="button"
                onClick={() => setExciseRows((rows) => [...rows, { excise_code: '', rate: undefined, notes: '' }])}
              >
                + Row
              </button>
            </div>

            <div className="mt-1 overflow-x-auto">
              <table className="table w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="px-1 py-0.5">Code</th>
                    <th className="px-1 py-0.5">Rate</th>
                    <th className="px-1 py-0.5">Notes</th>
                    <th className="px-1 py-0.5" />
                  </tr>
                </thead>
                <tbody>
                  {exciseRows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="px-1 py-0.5">
                        <input
                          className={`${inputSm} w-[8rem]`}
                          value={r.excise_code || ''}
                          onChange={(e) =>
                            setExciseRows((rows) => {
                              const next = [...rows];
                              next[idx] = { ...next[idx], excise_code: e.target.value };
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <input
                          className={`${inputSm} w-[4rem]`}
                          inputMode="decimal"
                          value={r.rate ?? ''}
                          onChange={(e) =>
                            setExciseRows((rows) => {
                              const next = [...rows];
                              next[idx] = { ...next[idx], rate: pmNumericFromEvent(e) };
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <input
                          className={`${inputSm} w-[14rem]`}
                          value={r.notes || ''}
                          onChange={(e) =>
                            setExciseRows((rows) => {
                              const next = [...rows];
                              next[idx] = { ...next[idx], notes: e.target.value };
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <button
                          className={btnSm}
                          type="button"
                          onClick={() => setExciseRows((rows) => rows.filter((_, i) => i !== idx))}
                          disabled={exciseRows.length <= 1}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <div className="pm-action-footer fixed inset-x-0 bottom-20 md:bottom-0 z-40 border-t border-slate-800 bg-slate-950/98 backdrop-blur px-3 py-2.5 safe-pb">
        <div className="w-full flex items-center justify-between gap-2">
          <button
            className={`${btnSm} border-slate-600`}
            type="button"
            onClick={() => setExportOpen(true)}
            title="Print or export CSV / PDF"
          >
            Export / Print
          </button>
          <div className="flex items-center gap-2">
            <button className={btnSm} type="button" onClick={resetToAdd}>
              Add new
            </button>
            <button
              className={`${btnSm} border-amber-500/40 bg-amber-500/15 text-amber-100 px-4`}
              type="button"
              onClick={saveAll}
              disabled={!canWrite || saving}
            >
              {saving ? 'Saving…' : selectedId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {exportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-export-title"
          onClick={() => !exportBusy && setExportOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pm-export-title" className="text-sm font-semibold text-slate-100">
              Export / Print
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Print shows Basic, Stock, Accounts, and Excise as on screen. CSV and PDF use the saved
              product.
            </p>
            {!selectedId && (
              <p className="mt-2 text-[11px] text-amber-200/90 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1">
                Save the product first to download CSV or PDF.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className={btnSm} onClick={printProduct}>
                Print
              </button>
              <button
                type="button"
                className={`${btnSm} border-emerald-700/50 text-emerald-200`}
                onClick={() => void exportCsv()}
                disabled={!selectedId || exportBusy !== null}
              >
                {exportBusy === 'csv' ? 'Preparing CSV…' : 'Download CSV'}
              </button>
              <button
                type="button"
                className={`${btnSm} border-red-700/50 text-red-200`}
                onClick={() => void exportPdf()}
                disabled={!selectedId || exportBusy !== null}
              >
                {exportBusy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              <button
                type="button"
                className={`${btnSm} mt-1 border-slate-600 text-slate-400`}
                onClick={() => setExportOpen(false)}
                disabled={exportBusy !== null}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

