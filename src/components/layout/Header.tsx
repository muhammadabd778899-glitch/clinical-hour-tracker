import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Icon } from '@/components/ui/Icon';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/activities', label: 'Activity Log', end: false },
  { to: '/requirements', label: 'Requirements', end: false },
  { to: '/ceus', label: 'CEU Tracker', end: false },
  { to: '/calendar', label: 'Calendar', end: false },
  { to: '/reports', label: 'Reports', end: false },
];

const QUICK_ADD_ITEMS = [
  { to: '/activities?quick=1', label: 'Quick log (fast entry)' },
  { to: '/activities/new?type=clinical', label: 'Log clinical activity' },
  { to: '/activities/new?type=supervision', label: 'Log supervision' },
  { to: '/ceus/new', label: 'Add CEU record' },
];

/** The product mark: an open progress ring with a pulse trace inside. */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#127569] via-[#0c5a50] to-[#073f38] ring-1 ring-white/20 ${className}`}
    >
      <svg viewBox="0 0 40 40" className="h-[68%] w-[68%]" fill="none">
        <path
          d="M30.5 12.6a11.5 11.5 0 1 0 0 14.8"
          stroke="#C79A3B"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M7.5 20h6l2.6-5.6 4.3 11.2 2.6-5.6h9.5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Brand() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label="All in One Clinical Tracker — home"
    >
      <BrandMark />
      <span className="hidden leading-tight sm:block">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-app-gold">
          All in One
        </span>
        <span className="block font-display text-[17px] font-semibold tracking-[-0.01em] text-white">
          Clinical Tracker
        </span>
      </span>
      <span className="font-display text-sm font-semibold text-white sm:hidden">Clinical Tracker</span>
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
    <header className="no-print sticky top-0 z-30 border-b border-white/10 bg-app-ink/95 text-white shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:px-6">
        <Brand />

        {/* Desktop navigation */}
        <nav aria-label="Primary" className="ml-3 hidden h-full flex-1 items-stretch lg:flex">
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
            <span
              className="badge border border-white/10 bg-white/10 text-app-gold-light"
              title="Your data is saved on this device"
            >
              <Icon name="wifi-off" size={13} />
              Offline
            </span>
          )}

          {/* Quick add */}
          <div className="relative" ref={quickRef}>
            <button
              type="button"
              className="btn-gold px-3 sm:px-4"
              aria-expanded={quickOpen}
              aria-haspopup="menu"
              onClick={() => setQuickOpen((v) => !v)}
            >
              <Icon name="plus" size={16} />
              <span className="hidden sm:inline">Quick Add</span>
              <span className="sm:hidden">Add</span>
            </button>
            {quickOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-app-border bg-white py-1.5 text-app-text shadow-pop"
              >
                {QUICK_ADD_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    role="menuitem"
                    to={item.to}
                    className="block px-4 py-2.5 text-sm font-medium transition-colors hover:bg-app-primary-light/70 hover:text-app-primary"
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
              `hidden rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:block ${
                isActive ? 'bg-white/10 text-white' : 'text-[#BFCFC9] hover:bg-white/5 hover:text-white'
              }`
            }
          >
            Settings &amp; Help
          </NavLink>

          <NavLink
            to="/settings"
            aria-label="Settings and help"
            className={({ isActive }) =>
              `hidden rounded-xl px-2.5 py-2 text-sm transition-colors sm:block lg:hidden ${
                isActive ? 'bg-white/10 text-white' : 'text-[#BFCFC9] hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon name="settings" size={18} />
          </NavLink>

          {/* Mobile "More" menu */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 lg:hidden"
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
          className="animate-fade border-t border-white/10 bg-app-ink px-4 pb-4 lg:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between border-b border-white/10 py-3 text-sm font-medium ${
                  isActive ? 'text-app-gold' : 'text-[#D7E2DD]'
                }`
              }
            >
              {item.label}
              <Icon name="chevron-right" size={15} className="opacity-50" />
            </NavLink>
          ))}
          <NavLink
            to="/quality"
            className="flex items-center justify-between border-b border-white/10 py-3 text-sm font-medium text-[#D7E2DD]"
          >
            Record Quality Check
            <Icon name="chevron-right" size={15} className="opacity-50" />
          </NavLink>
          <NavLink
            to="/settings"
            className="flex items-center justify-between py-3 text-sm font-medium text-[#D7E2DD]"
          >
            Settings &amp; Help
            <Icon name="chevron-right" size={15} className="opacity-50" />
          </NavLink>
        </nav>
      )}
    </header>
  );
}
