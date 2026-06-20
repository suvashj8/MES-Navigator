import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type StandardProduct, type Staff } from '../api';
import ModalCloseButton from './ModalCloseButton';
import { useAuth } from '../hooks/useAuth';
import { displayStaffRegNo } from '../utils/staffRegNo';

type NavAction = { id: string; label: string; hint?: string; to: string };

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  navActions: NavAction[];
};

type Result =
  | { kind: 'nav'; key: string; label: string; hint?: string; to: string }
  | { kind: 'worker'; key: string; label: string; hint?: string; to: string }
  | { kind: 'product'; key: string; label: string; hint?: string; to: string };

export default function CommandPalette({ open, onClose, initialQuery = '', navActions }: Props) {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQuery);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [products, setProducts] = useState<StandardProduct[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQ(initialQuery);
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 1) {
      setStaff([]);
      setProducts([]);
      return;
    }

    setLoadingStaff(true);
    api.staff({ q: query }).then(setStaff).catch(() => setStaff([])).finally(() => setLoadingStaff(false));

    if (can('standards:read')) {
      setLoadingProducts(true);
      api.standardProducts({ q: query }).then(setProducts).catch(() => setProducts([])).finally(() => setLoadingProducts(false));
    } else {
      setProducts([]);
    }
  }, [open, q, can]);

  const results: Result[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const nav: Result[] = navActions
      .filter((a) => !query || a.label.toLowerCase().includes(query))
      .slice(0, 8)
      .map((a) => ({ kind: 'nav', key: a.id, label: a.label, hint: a.hint, to: a.to }));

    const entryPath = user?.role === 'operator' ? '/floor' : '/daily-entry';
    const workers: Result[] = staff.slice(0, 8).map((s) => ({
      kind: 'worker',
      key: `w-${s.id}`,
      label: s.name,
      hint: `${displayStaffRegNo(s)} · ${s.department}`,
      to: `${entryPath}?staff_id=${encodeURIComponent(String(s.id))}`,
    }));

    const prods: Result[] = products.slice(0, 8).map((p) => ({
      kind: 'product',
      key: `p-${p.prod_code}`,
      label: `${p.prod_code} — ${p.prod_name}`,
      hint: 'Open grading rules',
      to: `/standards?q=${encodeURIComponent(p.prod_code)}`,
    }));

    return [...nav, ...workers, ...prods];
  }, [q, navActions, staff, products, user?.role]);

  const clampedIndex = Math.min(Math.max(0, activeIndex), Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => i + 1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[clampedIndex];
        if (r) {
          navigate(r.to);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, clampedIndex, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-20 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2">
        <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <ModalCloseButton onClick={onClose} className="absolute right-2 top-2 z-10" />
          <div className="p-3 pr-12 border-b border-slate-800">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setActiveIndex(0); }}
              placeholder="Search: worker / reg # / product…"
              className="w-full h-11 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-400"
            />
            <p className="text-[11px] text-slate-500 mt-2">
              Tip: type a reg # or worker name · Enter to open · Esc to close
              {(loadingStaff || loadingProducts) && <span className="ml-2 text-slate-400">Searching…</span>}
            </p>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto py-2">
            {results.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No results.
              </li>
            ) : results.map((r, idx) => (
              <li key={r.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    navigate(r.to);
                    onClose();
                  }}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-4 text-left ${
                    idx === clampedIndex ? 'bg-amber-500/10' : 'hover:bg-slate-800/70'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-100 truncate">{r.label}</span>
                    {r.hint && <span className="block text-xs text-slate-500 truncate">{r.hint}</span>}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {r.kind === 'nav' ? 'Go' : r.kind === 'worker' ? 'Entry' : 'Setup'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

