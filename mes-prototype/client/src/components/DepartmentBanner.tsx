import { useEffect, useState } from 'react';
import { api, type AuthScope } from '../api';

export default function DepartmentBanner() {
  const [scope, setScope] = useState<AuthScope | null>(null);

  useEffect(() => {
    api.scope().then(setScope);
  }, []);

  if (!scope?.locked || !scope.department) return null;

  return (
    <div className="mb-4 px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sm text-sky-200">
      Viewing data for department: <strong>{scope.department}</strong> (supervisor scope)
    </div>
  );
}
