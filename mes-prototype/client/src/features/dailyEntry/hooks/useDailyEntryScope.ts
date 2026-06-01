import { useEffect, useMemo, useState } from 'react';
import { api, type Activity, type Staff } from '../../../api';

export function useDailyEntryScope(search: string) {
  const today = new Date().toISOString().slice(0, 10);
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const prefillStaffId = sp.get('staff_id') || '';
  const prefillDate = sp.get('date') || '';

  const [date, setDate] = useState(today);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptLocked, setDeptLocked] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  useEffect(() => {
    api.departments().then(setDepartments);
    api.activities().then(setActivities);
    api.scope().then((s) => {
      if (s.locked && s.department) {
        setDepartment(s.department);
        setDeptLocked(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!prefillDate) return;
    setDate(prefillDate);
  }, [prefillDate]);

  useEffect(() => {
    api.staff(department ? { department } : undefined).then(setStaffList);
  }, [department]);

  return {
    date,
    setDate,
    department,
    setDepartment,
    departments,
    deptLocked,
    activities,
    staffList,
    prefillStaffId,
    prefillDate,
  };
}
