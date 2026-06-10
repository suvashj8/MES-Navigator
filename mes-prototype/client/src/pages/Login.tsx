import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Factory, Lock, Sparkles, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { consumeLoginMessage } from '@/authSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const DEMO_USERS = [
  { user: 'admin', pass: 'admin123', role: 'Admin' },
  { user: 'supervisor', pass: 'super123', role: 'Supervisor' },
  { user: 'operator', pass: 'oper123', role: 'Operator' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notice] = useState(() => consumeLoginMessage());

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-[100dvh] lg:min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/40">
            <Factory className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-sidebar-foreground">MES</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-sidebar-foreground">
            Production grading and floor performance, in one place
          </h1>
          <p className="max-w-md text-sidebar-foreground/90">
            Daily entry, scorecards, grading rules, and Nepal AD/BS calendars — built for Navigator Bead for Life shop-floor teams.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Floor entry', 'Dual calendar', 'Offline sync', 'Role-based access'].map((t) => (
              <span
                key={t}
                className="rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1 text-xs text-sidebar-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-sidebar-foreground/80">© Navigator Bead for Life MES</p>
      </div>

      <div className="flex flex-col items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] mesh-bg sm:p-6">
        <div className="mb-6 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
            <Factory className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-foreground">MES</p>
            <p className="text-xs text-muted-foreground">Navigator Bead for Life</p>
          </div>
        </div>
        <Card className="w-full max-w-md border-0 shadow-xl shadow-primary/5">
          <CardHeader className="space-y-1 text-center sm:text-left">
            <div className="mb-2 flex justify-center sm:justify-start">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your MES workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const username = String(fd.get('username')).trim();
                const password = String(fd.get('password'));
                setLoading(true);
                try {
                  await login(username, password);
                  toast.success('Signed in successfully');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Sign in failed');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {notice && (
                <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">{notice}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            {import.meta.env.DEV ? (
              <div className="mt-6 space-y-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">Demo accounts (dev — click to fill)</p>
                {DEMO_USERS.map((d) => (
                  <button
                    key={d.user}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/60"
                    onClick={() => {
                      const form = document.getElementById('username') as HTMLInputElement | null;
                      const pass = document.getElementById('password') as HTMLInputElement | null;
                      if (form) form.value = d.user;
                      if (pass) pass.value = d.pass;
                    }}
                  >
                    <span className="font-mono text-primary">{d.user}</span>
                    <span className="text-muted-foreground">{d.role}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Need access? Contact your supervisor or IT.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
