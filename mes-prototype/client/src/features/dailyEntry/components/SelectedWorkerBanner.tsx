import StaffAvatar from '../../../components/StaffAvatar';
import type { Staff } from '../../../api';
import { displayStaffRegNo } from '../../../utils/staffRegNo';

export default function SelectedWorkerBanner({
  worker,
  floorMode,
  prefillFlash,
}: {
  worker: Staff;
  floorMode: boolean;
  prefillFlash: boolean;
}) {
  const avatarSize = floorMode ? 'h-12 w-12 rounded-xl' : 'h-10 w-10 rounded-lg';

  return (
    <div
      className={
        floorMode
          ? `rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${prefillFlash ? 'ring-2 ring-amber-400/40' : ''}`
          : `rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${prefillFlash ? 'ring-2 ring-amber-400/30' : ''}`
      }
      aria-label="Selected worker"
    >
      <div className="flex items-center gap-3 min-w-0">
        <StaffAvatar
          staffId={worker.id}
          hasPhoto={worker.has_photo}
          name={worker.name}
          className={avatarSize}
          imgClassName="h-full w-full object-cover"
        />
        <div className="min-w-0">
          <p className={floorMode ? 'text-sm text-amber-200/90 font-semibold' : 'text-sm text-slate-200 font-semibold'}>
            {worker.name}
          </p>
          <p className="text-xs text-slate-400 truncate">
            <span className="font-mono">{displayStaffRegNo(worker)}</span>
            <span className="mx-2">·</span>
            {worker.department}
          </p>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Confirm selected worker</div>
    </div>
  );
}
