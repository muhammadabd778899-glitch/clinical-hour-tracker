import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Header } from './Header';

function renderHeader(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Header />
      <Routes>
        <Route path="*" element={<div>page content</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Header navigation', () => {
  it('shows the brand and every primary destination', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /all in one clinical tracker/i })).toHaveAttribute('href', '/');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Overview', 'Activity Log', 'Requirements', 'CEU Tracker', 'Calendar', 'Reports']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active page clearly', () => {
    renderHeader('/activities');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Activity Log' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('opens the Quick Add menu with its three actions', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: /quick add/i }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Log clinical activity' })).toHaveAttribute(
      'href',
      '/activities/new?type=clinical',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Log supervision' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Add CEU record' })).toHaveAttribute('href', '/ceus/new');
  });

  it('exposes Settings & Help from the header', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Settings & Help' })).toHaveAttribute('href', '/settings');
  });

  it('shows the mobile More menu with secondary destinations', async () => {
    const user = userEvent.setup();
    renderHeader();
    const moreButton = screen.getByRole('button', { name: 'More' });
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = screen.getByRole('navigation', { name: 'Primary mobile' });
    expect(within(mobileNav).getByRole('link', { name: 'Record Quality Check' })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: 'Settings & Help' })).toBeInTheDocument();
  });

  it('never renders a sidebar', () => {
    const { container } = renderHeader();
    expect(container.querySelector('aside')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});
