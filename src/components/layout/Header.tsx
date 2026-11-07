import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/activities', label: 'Activity Log', end: false },
  { to: '/requirements', label: 'Requirements', end: false },
  { to: '/ceus', label: 'CEU Tracker', end: false },
  { to: '/calendar', label: 'Calendar', end: false },
  { to: '/reports', label: 'Reports', end: false },
];

const QUICK_ADD_ITEMS = [
  { to: '/activities/new?type=clinical', label: 'Log clinical activity' },
  { to: '/activities/new?type=supervision', label: 'Log supervision' },
  { to: '/ceus/new', label: 'Add CEU record' },
];

function Brand() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="All in One Clinical Tracker — home">
      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-primary text-sm font-bold text-white">
        C
      </span>
      <span className="hidden text-sm font-semibold leading-tight sm:block">
        All in One
        <br />
        Clinical Tracker
      </span>
      <span className="text-sm font-semibold sm:hidden">Clinical Tracker</span>
    </Link>
  );
}

/** Website-style horizontal top navigation (no sidebar, ever). */
export function Header() {
  const location = useLocation();
  const online = useOnlineStatus();
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation (also covers Back/Forward).
  useEffect(() => {
    setQuickOpen(false);
    setMoreOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!quickOpen) return;
    const onClick = (e: MouseEvent) => {
      if (quickRef.current && !quickRef.current.contains(e.target as Node)) setQuickOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [quickOpen]);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-app-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <Brand />

        {/* Desktop navigation */}
        <nav aria-label="Primary" className="hidden h-full flex-1 items-stretch md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {!online && (
            <span className="badge bg-app-warning-light text-app-warning" title="Your data is saved on this device">
              Offline
            </span>
          )}

          {/* Quick add */}
          <div className="relative" ref={quickRef}>
            <button
              type="button"
              className="btn-primary"
              aria-expanded={quickOpen}
              aria-haspopup="menu"
              onClick={() => setQuickOpen((v) => !v)}
            >
              <span aria-hidden="true">＋</span>
              <span className="hidden sm:inline">Quick Add</span>
              <span className="sm:hidden">Add</span>
            </button>
            {quickOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-56 rounded-lg border border-app-border bg-white py-1 shadow-pop"
              >
                {QUICK_ADD_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    role="menuitem"
                    to={item.to}
                    className="block px-4 py-2 text-sm text-app-text hover:bg-app-primary-light"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `hidden rounded-lg px-3 py-2 text-sm font-medium sm:block ${
                isActive ? 'bg-app-primary-light text-app-primary' : 'text-app-muted hover:bg-gray-100'
              }`
            }
          >
            Settings &amp; Help
          </NavLink>

          <NavLink
            to="/settings"
            aria-label="Settings and help"
            className={({ isActive }) =>
              `rounded-lg px-2.5 py-2 text-sm sm:hidden ${
                isActive ? 'bg-app-primary-light text-app-primary' : 'text-app-muted'
              }`
            }
          >
            ⚙
          </NavLink>

          {/* Mobile "More" menu */}
          <button
            type="button"
            className="btn-secondary px-3 md:hidden"
            aria-expanded={moreOpen}
            aria-controls="mobile-nav"
            onClick={() => setMoreOpen((v) => !v)}
          >
            {moreOpen ? 'Close' : 'More'}
          </button>
        </div>
      </div>

      {/* Mobile navigation sheet */}
      {moreOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary mobile"
          className="border-t border-app-border bg-white px-3 pb-3 md:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block border-b border-app-border px-1 py-3 text-sm font-medium ${
                  isActive ? 'text-app-primary' : 'text-app-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/quality" className="block px-1 py-3 text-sm font-medium text-app-text">
            Record Quality Check
          </NavLink>
          <NavLink to="/settings" className="block px-1 py-3 text-sm font-medium text-app-text">
            Settings &amp; Help
          </NavLink>
        </nav>
      )}
    </header>
  );
}
