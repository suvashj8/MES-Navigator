import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_USERS = [
  { user: 'admin', pass: 'admin123', role: 'Admin' },
  { user: 'supervisor', pass: 'super123', role: 'Supervisor' },
  { user: 'operator', pass: 'oper123', role: 'Operator' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-amber-400 text-xs uppercase tracking-widest font-semibold">MES</p>
          <h1 className="text-2xl font-bold mt-2">Navigator Bead for Life MES</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {import.meta.env.DEV ? (
          <div className="mt-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-3">Demo accounts (dev only — click to fill)</p>
            <div className="space-y-2">
              {DEMO_USERS.map((d) => (
                <button
                  key={d.user}
                  type="button"
                  onClick={() => fillDemo(d.user, d.pass)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-sm flex justify-between"
                >
                  <span className="font-mono text-amber-200/80">{d.user}</span>
                  <span className="text-slate-500">{d.role}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-300 font-medium">Need access?</p>
            <p className="text-xs text-slate-500 mt-1">
              Contact IT / supervisor to create your account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
