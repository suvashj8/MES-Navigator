import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { MesAppSidebar } from '@/components/layout/mes-app-sidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import SessionExpiryBanner from '@/components/SessionExpiryBanner';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function MesAppLayout() {
  const [open, setOpen] = useState(false);
  const { sessionWarning, renewingSession, renewSession } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-background">
      <aside className="hidden shrink-0 lg:block">
        <MesAppSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(100vw-2rem,18rem)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <MesAppSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">Navigator Bead for Life MES</p>
          </div>
        </header>

        <main className="mesh-bg min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10">
          {sessionWarning && (
            <SessionExpiryBanner
              message={sessionWarning}
              onRenew={() => renewSession()}
              renewing={renewingSession}
            />
          )}
          <ErrorBoundary resetKey={location.pathname} title="This page could not be loaded" homeTo="/" homeLabel="Go home">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
