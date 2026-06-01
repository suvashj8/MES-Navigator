import { useState } from 'react';
import { api } from '../api';
import PageShell from '../components/PageShell';
import { useAuth } from '../hooks/useAuth';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        display_name: displayName,
        ...(password ? { password } : {}),
      });
      setMessage('Profile updated successfully');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell variant="narrow">
      <header className="mb-8">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p className="text-slate-400 text-sm mt-1">Update your display name and password</p>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 text-sm">
        <p><span className="text-slate-500">Username:</span> <span className="font-mono">{user?.username}</span></p>
        <p className="mt-2"><span className="text-slate-500">Role:</span> <span className="capitalize">{user?.role}</span></p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs text-slate-400 uppercase">Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" required />
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase">New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current"
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase">Confirm Password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2" />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
        <button type="submit" disabled={saving}
          className="w-full py-2.5 rounded-lg bg-amber-500 text-slate-900 font-semibold disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </PageShell>
  );
}
