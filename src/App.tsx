import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';
import { LoadingState } from '@/components/ui/feedback';
import { useSettings } from '@/hooks/useData';
import { OverviewPage } from '@/pages/OverviewPage';
import { ActivityListPage } from '@/pages/ActivityListPage';
import { ActivityFormPage } from '@/pages/ActivityFormPage';
import { ActivityDetailPage } from '@/pages/ActivityDetailPage';
import { RequirementsPage } from '@/pages/RequirementsPage';
import { CeuListPage } from '@/pages/CeuListPage';
import { CeuFormPage } from '@/pages/CeuFormPage';
import { CeuDetailPage } from '@/pages/CeuDetailPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { QualityPage } from '@/pages/QualityPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WelcomePage } from '@/pages/WelcomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Sends first-run users to the guided setup; keeps them out afterwards. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const location = useLocation();

  if (settings === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LoadingState label="Opening your workspace…" />
      </div>
    );
  }
  if (!settings.onboarded && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }
  if (settings.onboarded && location.pathname === '/welcome') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="no-print border-t border-app-border bg-white px-4 py-4 text-center text-xs text-app-muted">
        All in One Clinical Tracker stores your records on this device only. It is a progress tracker — not a
        medical record system. Back up regularly from Settings &amp; Help.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <OnboardingGate>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/" element={<OverviewPage />} />
          <Route path="/activities" element={<ActivityListPage />} />
          <Route path="/activities/new" element={<ActivityFormPage />} />
          <Route path="/activities/:id" element={<ActivityDetailPage />} />
          <Route path="/activities/:id/edit" element={<ActivityDetailPage />} />
          <Route path="/requirements" element={<RequirementsPage />} />
          <Route path="/ceus" element={<CeuListPage />} />
          <Route path="/ceus/new" element={<CeuFormPage />} />
          <Route path="/ceus/:id" element={<CeuDetailPage />} />
          <Route path="/ceus/:id/edit" element={<CeuDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/quality" element={<QualityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </OnboardingGate>
    </Shell>
  );
}
