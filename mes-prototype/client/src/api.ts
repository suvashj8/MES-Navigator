const BASE = '/api';
let authToken: string | null = null;

// Small in-memory GET cache to speed up back-to-back navigation.
const getCache = new Map<string, { ts: number; data: unknown }>();
const GET_CACHE_TTL_MS = 10_000;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const method = (options?.method || 'GET').toUpperCase();
  const isCacheableGet = method === 'GET' && !options?.body;
  const cacheKey = isCacheableGet ? `${authToken || 'anon'}::${path}` : '';
  if (isCacheableGet) {
    const hit = getCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < GET_CACHE_TTL_MS) return hit.data as T;
  } else {
    // Any mutation invalidates cached GETs.
    getCache.clear();
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (res.status === 401) {
    localStorage.removeItem('mes_token');
    setAuthToken(null);
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  const json = await res.json();
  if (isCacheableGet) getCache.set(cacheKey, { ts: Date.now(), data: json });
  return json;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ user: User }>('/auth/me'),
  scope: () => request<AuthScope>('/auth/scope'),
  nepaliDate: (ad: string) => request<NepaliDateInfo>(`/nepali-date?ad=${ad}`),
  nepaliDateBs: (bs: string) => request<NepaliDateInfo>(`/nepali-date?bs=${bs}`),
  nepaliToday: () => request<NepaliDateInfo>('/nepali-date'),

  dashboard: (params?: { date?: string; notGradedOffset?: number; notGradedLimit?: number }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.notGradedOffset != null) q.set('not_graded_offset', String(params.notGradedOffset));
    if (params?.notGradedLimit != null) q.set('not_graded_limit', String(params.notGradedLimit));
    const qs = q.toString();
    return request<Dashboard>(`/dashboard${qs ? `?${qs}` : ''}`);
  },

  staff: (params?: { department?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.department) q.set('department', params.department);
    if (params?.q) q.set('q', params.q);
    return request<Staff[]>(`/staff?${q}`);
  },

  departments: () => request<string[]>('/departments'),
  activities: () => request<Activity[]>('/activities'),
  articles: (search?: string) => request<Article[]>(`/articles${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  costCenters: (activity_id?: number) =>
    request<CostCenter[]>(`/cost-centers${activity_id ? `?activity_id=${activity_id}` : ''}`),

  standardProducts: (params?: { q?: string; cost_center_code?: string }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set('q', params.q);
    if (params?.cost_center_code) q.set('cost_center_code', params.cost_center_code);
    return request<StandardProduct[]>(`/grading-standards/products?${q}`);
  },

  activityMappings: () => request<ActivityMapping[]>('/activity-mappings'),
  addActivityMapping: (activity_id: number, cost_center_code: string) =>
    request<ActivityMapping>('/activity-mappings', {
      method: 'POST',
      body: JSON.stringify({ activity_id, cost_center_code }),
    }),
  deleteActivityMapping: (id: number) =>
    request<{ ok: boolean }>(`/activity-mappings/${id}`, { method: 'DELETE' }),

  gradingStandards: (search?: string) =>
    request<GradingStandard[]>(`/grading-standards${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  getStandard: (id: number) => request<GradingStandard>(`/grading-standards/${id}`),
  createStandard: (body: StandardInput) =>
    request<GradingStandard>('/grading-standards', { method: 'POST', body: JSON.stringify(body) }),
  updateStandard: (id: number, body: StandardInput) =>
    request<GradingStandard>(`/grading-standards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteStandard: (id: number) =>
    request<{ ok: boolean }>(`/grading-standards/${id}`, { method: 'DELETE' }),

  lookupStandard: (prod_code: string, cost_center_code: string, entry_date?: string) => {
    const params = new URLSearchParams({ prod_code, cost_center_code });
    if (entry_date) params.set('entry_date', entry_date);
    return request<GradingStandard>(`/grading-standards/lookup?${params}`);
  },

  previewGrade: (body: GradePreviewInput) =>
    request<GradePreviewResult>('/grade/preview', { method: 'POST', body: JSON.stringify(body) }),

  dailyGrading: (params?: { date?: string; department?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.department) q.set('department', params.department);
    return request<DailyEntry[]>(`/daily-grading?${q}`);
  },
  saveDailyGrading: (body: DailyEntryInput) =>
    request<DailyEntry>('/daily-grading', { method: 'POST', body: JSON.stringify(body) }),
  deleteDailyGrading: (id: number) =>
    request<{ ok: boolean }>(`/daily-grading/${id}`, { method: 'DELETE' }),
  restoreDailyGrading: (id: number) =>
    request<{ ok: boolean }>(`/daily-grading/${id}/restore`, { method: 'POST' }),
  deletedDailyGrading: (params?: { offset?: number; limit?: number; department?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.department) q.set('department', params.department);
    if (params?.q) q.set('q', params.q);
    return request<Paginated<DeletedDailyEntry>>(`/daily-grading/deleted?${q}`);
  },
  hardDeleteDailyGrading: (id: number) =>
    request<{ ok: boolean }>(`/daily-grading/${id}/hard`, { method: 'DELETE' }),
  dailyGradingAudit: (id: number) =>
    request<{ rows: DailyGradingAuditRow[] }>(`/daily-grading/${id}/audit`),

  scorecards: (params: ScorecardParams) => {
    const q = new URLSearchParams();
    if (params.period) q.set('period', params.period);
    if (params.anchor) q.set('anchor', params.anchor);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.department) q.set('department', params.department);
    if (params.staff_id) q.set('staff_id', String(params.staff_id));
    return request<ScorecardReport>(`/reports/scorecards?${q}`);
  },

  exportScorecardsCsv: async (params: ScorecardParams) => {
    const q = new URLSearchParams();
    if (params.period) q.set('period', params.period);
    if (params.anchor) q.set('anchor', params.anchor);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.department) q.set('department', params.department);
    if (params.staff_id) q.set('staff_id', String(params.staff_id));
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/reports/scorecards/export?${q}`, { headers });
    if (res.status === 401) {
      localStorage.removeItem('mes_token');
      setAuthToken(null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Export failed');
    }
    return res.blob();
  },

  users: () => request<AppUser[]>('/users'),
  createUser: (body: UserInput) =>
    request<AppUser>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: number, body: Partial<UserInput & { is_active?: number }>) =>
    request<AppUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  createStaff: (body: { reg_no: number; name: string; department: string; photo_data?: string | null }) =>
    request<Staff>('/staff', { method: 'POST', body: JSON.stringify(body) }),

  updateProfile: (body: { display_name?: string; password?: string }) =>
    request<{ user: User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  workerDetail: (staffId: number, params: ScorecardParams) => {
    const q = new URLSearchParams();
    if (params.period) q.set('period', params.period);
    if (params.anchor) q.set('anchor', params.anchor);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    return request<WorkerDetail>(`/reports/worker/${staffId}?${q}`);
  },

  exportScorecardsPdf: async (params: ScorecardParams) => {
    const q = new URLSearchParams();
    if (params.period) q.set('period', params.period);
    if (params.anchor) q.set('anchor', params.anchor);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.department) q.set('department', params.department);
    if (params.staff_id) q.set('staff_id', String(params.staff_id));
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/reports/scorecards/export.pdf?${q}`, { headers });
    if (!res.ok) throw new Error('PDF export failed');
    return res.blob();
  },

  exportWorkerPdf: async (staffId: number, params: ScorecardParams) => {
    const q = new URLSearchParams();
    if (params.period) q.set('period', params.period);
    if (params.anchor) q.set('anchor', params.anchor);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/reports/worker/${staffId}/export.pdf?${q}`, { headers });
    if (!res.ok) throw new Error('PDF export failed');
    return res.blob();
  },

  exportDailyGradingCsv: async (date: string, department?: string) => {
    const q = new URLSearchParams({ date });
    if (department) q.set('department', department);
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/daily-grading/export?${q}`, { headers });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },

  logMissingStandard: (body: {
    entry_date: string;
    department?: string;
    staff_id?: number;
    staff_name?: string;
    activity_id?: number;
    activity_name?: string;
    cost_center_code?: string;
    cost_center_name?: string;
    prod_code: string;
    prod_name?: string;
  }) => request<{ ok: true }>('/missing-standards', { method: 'POST', body: JSON.stringify(body) }),

  missingStandards: (params?: { date?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    const qs = q.toString();
    return request<{ date: string; scope?: AuthScope; rows: any[] }>(`/missing-standards${qs ? `?${qs}` : ''}`);
  },
};

export interface User {
  id: number;
  username: string;
  role: 'operator' | 'supervisor' | 'admin';
  display_name: string;
  department?: string | null;
}

export interface AuthScope {
  department: string | null;
  locked: boolean;
}

export interface NepaliDateInfo {
  ad: string;
  bs: string;
  bs_display: string;
  bs_month_name?: string;
}

export interface Staff {
  id: number;
  reg_no: number;
  name: string;
  department: string;
  photo_data?: string | null;
}

export interface Activity {
  id: number;
  code: number;
  name: string;
}

export interface Article {
  id: number;
  code: string;
  name: string;
  display: string;
}

export interface CostCenter {
  code: string;
  name: string;
}

export interface StandardProduct {
  prod_code: string;
  prod_name: string;
}

export interface AppUser {
  id: number;
  username: string;
  role: 'operator' | 'supervisor' | 'admin';
  display_name: string;
  department: string | null;
  is_active: number;
}

export interface UserInput {
  username: string;
  password: string;
  role: 'operator' | 'supervisor' | 'admin';
  display_name: string;
  department?: string | null;
}

export interface ActivityMapping {
  id: number;
  activity_id: number;
  activity_code: number;
  activity_name: string;
  cost_center_code: string;
  cost_center_name: string;
}

export interface GradingStandard {
  id: number;
  prod_code: string;
  prod_name: string;
  cost_center_code: string;
  cost_center_name: string;
  standard_min: number;
  std_qty: number;
  c_value: number;
  b_value: number;
  a_value: number;
  aplus_value: number;
  effective_date: string | null;
}

export interface StandardInput {
  prod_code: string;
  prod_name: string;
  cost_center_code: string;
  cost_center_name: string;
  standard_min?: number;
  std_qty: number;
  c_value: number;
  b_value: number;
  a_value: number;
  aplus_value: number;
  effective_date?: string | null;
}

export interface GradePreviewInput {
  prod_code: string;
  cost_center_code: string;
  quantity: number;
  entry_date?: string;
}

export interface GradePreviewResult {
  standard: GradingStandard;
  per_day_qty: number;
  working_min: number;
  c_time_min: number;
  p_hour: number;
  w_hour: number;
  w_min: number;
  grade: string;
}

export interface DailyEntry {
  id: number;
  entry_date: string;
  staff_id: number;
  staff_name?: string;
  reg_no?: number;
  department?: string;
  prod_code: string;
  prod_name?: string;
  cost_center_code: string;
  cost_center_name?: string;
  quantity: number;
  w_min: number;
  grade: string;
  remarks?: string;
  entered_by?: string;
  created_at?: string;
  updated_by?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export type DeletedDailyEntry = DailyEntry & { deleted_at: string };

export interface Paginated<T> {
  rows: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface DailyGradingAuditRow {
  id: number;
  entry_id: number;
  action: 'create' | 'update' | 'delete' | 'restore' | 'hard_delete';
  actor?: string | null;
  at: string;
  old_values?: string | null;
  new_values?: string | null;
}

export interface DailyEntryInput {
  entry_date: string;
  staff_id: number;
  prod_code: string;
  cost_center_code: string;
  quantity: number;
  remarks?: string;
}

export interface Dashboard {
  date: string;
  todayEntries: number;
  staffCount: number;
  standardsCount: number;
  gradeDist: { grade: string; count: number }[];
  deptSummary: { department: string; grade: string; count: number }[];
  trend: { from: string; to: string; days: TrendDay[] };
  weekWorkersGraded: number;
  weekEntries: number;
  workersNotGradedToday?: { id: number; reg_no: number; name: string; department: string }[];
  workersNotGradedTotal?: number;
  workersNotGradedOffset?: number;
  workersNotGradedLimit?: number;
}

export interface ScorecardParams {
  period?: 'weekly' | 'monthly' | 'custom';
  anchor?: string;
  from?: string;
  to?: string;
  department?: string;
  staff_id?: number;
}

export interface TrendDay {
  date: string;
  total: number;
  grades: { C: number; B: number; A: number; AA: number };
}

export interface WorkerDetail {
  staff: Staff;
  summary: Scorecard | null;
  entries: {
    id: number;
    entry_date: string;
    prod_code: string;
    prod_name?: string;
    cost_center_code: string;
    cost_center_name?: string;
    quantity: number;
    w_min: number;
    grade: string;
    remarks?: string;
    entered_by?: string;
    created_at?: string;
    updated_by?: string | null;
    updated_at?: string | null;
  }[];
  from: string;
  to: string;
}

export interface Scorecard {
  staff_id: number;
  reg_no: number;
  staff_name: string;
  department: string;
  total_entries: number;
  days_worked: number;
  total_quantity: number;
  total_w_min: number;
  avg_score: number;
  rating: string;
  grade_distribution: { grade: string; count: number; percent: number }[];
  top_grade: string;
}

export interface ScorecardReport {
  period: string;
  from: string;
  to: string;
  label: string;
  scorecards: Scorecard[];
  scope?: AuthScope;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { downloadBlob };
