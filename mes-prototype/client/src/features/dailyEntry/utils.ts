export type WorkflowStep = 'worker' | 'activity' | 'costCenter' | 'product' | 'quantity' | 'ready';

export function nextWorkflowStep(fields: {
  staffId: string;
  activityId: string;
  costCenter: string;
  prodCode: string;
  quantity: string;
}): WorkflowStep {
  if (!fields.staffId) return 'worker';
  if (!fields.activityId) return 'activity';
  if (!fields.costCenter) return 'costCenter';
  if (!fields.prodCode) return 'product';
  if (!fields.quantity) return 'quantity';
  return 'ready';
}

export function controlCls(floorMode: boolean, disabled = false) {
  const base = floorMode
    ? 'w-full h-12 rounded-xl bg-slate-800 border border-slate-700 px-3 text-base'
    : 'w-full h-10 rounded-lg bg-slate-800 border border-slate-700 px-3 text-sm';
  return `${base}${disabled ? ' opacity-50 cursor-not-allowed' : ''}`;
}

export const FORM_ROW_CLS = 'flex flex-wrap items-start gap-x-4 gap-y-4';
