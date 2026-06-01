import { useEffect, useState } from 'react';
import { getAuthToken } from '../api';

const blobCache = new Map<number, string>();

type Props = {
  staffId: number;
  hasPhoto?: boolean;
  name?: string;
  className?: string;
  imgClassName?: string;
};

/** Loads staff photo via authenticated API (JWT); caches blob URLs per session. */
export default function StaffAvatar({ staffId, hasPhoto, name, className = '', imgClassName = '' }: Props) {
  const [src, setSrc] = useState<string | null>(() => (hasPhoto ? blobCache.get(staffId) ?? null : null));
  const initial = String(name || 'W').trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!hasPhoto) {
      setSrc(null);
      return;
    }
    const cached = blobCache.get(staffId);
    if (cached) {
      setSrc(cached);
      return;
    }
    const token = getAuthToken();
    let revoked: string | null = null;
    const ac = new AbortController();
    fetch(`/api/staff/${staffId}/photo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob) return;
        revoked = URL.createObjectURL(blob);
        blobCache.set(staffId, revoked);
        setSrc(revoked);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [staffId, hasPhoto]);

  if (src) {
    return (
      <span className={`overflow-hidden shrink-0 ${className}`}>
        <img src={src} alt="" className={imgClassName || 'h-full w-full object-cover'} />
      </span>
    );
  }

  return (
    <span
      className={`border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center font-semibold text-amber-200/80 ${className}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
