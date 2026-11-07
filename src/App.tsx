import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Icon } from '@/components/ui/Icon';
import { LoadingState } from '@/components/ui/feedback';
import { SampleBanner } from '@/components/sample/SampleWorkspace';
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

/** New pages should start at the top, not where the previous page was scrolled. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <SampleBanner />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-6 sm:py-9">
        <div className="page-shell">{children}</div>
      </main>
      <footer className="no-print bg-app-ink text-[#A9BBB4]">
        <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xl">
              <p className="font-display text-lg font-semibold tracking-[-0.01em] text-white">
                All in One Clinical Tracker
              </p>
              <p className="mt-1.5 text-xs leading-relaxed">
                A calm, private workspace for clinical hours, supervision, CEUs and career milestones. Your records
                stay on this device — it is a progress tracker, not a medical record system.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <Link to="/quality" className="inline-flex items-center gap-1.5 hover:text-white">
                <Icon name="shield" size={14} /> Quality check
              </Link>
              <Link to="/reports" className="inline-flex items-center gap-1.5 hover:text-white">
                <Icon name="chart" size={14} /> Reports
              </Link>
              <Link to="/settings" className="inline-flex items-center gap-1.5 hover:text-white">
                <Icon name="settings" size={14} /> Backups &amp; settings
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="lock" size={13} /> Offline-first · no account · no cloud
            </span>
            <span>Back up regularly from Settings &amp; Help.</span>
          </div>
        </div>
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
