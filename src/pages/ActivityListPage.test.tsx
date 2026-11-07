import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ActivityListPage } from './ActivityListPage';
import { ToastProvider } from '@/components/ui/Toast';
import { initDatabase } from '@/db/database';
import { activityRepository, categoryRepository } from '@/repositories';
import { createActivity } from '@/services/activity';

beforeAll(async () => {
  await initDatabase();
  const categories = await categoryRepository.list();
  const direct = categories.find((c) => c.kind === 'direct')!;
  const individual = categories.find((c) => c.kind === 'individual_supervision')!;

  await createActivity({
    type: 'clinical',
    categoryId: direct.id,
    title: 'Counseling session',
    date: '2026-03-05',
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    location: null,
    notes: null,
  });
  await createActivity({
    type: 'supervision',
    categoryId: individual.id,
    title: 'Group supervision',
    date: '2026-03-06',
    startTime: null,
    endTime: null,
    durationMinutes: 45,
    location: null,
    notes: null,
  });
});

function renderList(entry = '/activities') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/activities" element={<ActivityListPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('ActivityListPage', () => {
  it('lists saved activities with their durations', async () => {
    renderList();
    expect(await screen.findByText('Counseling session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Group supervision/ })).toBeInTheDocument();
    expect(screen.getByTestId('result-count')).toHaveTextContent('Showing 2 of 2 activities');
    expect(screen.getByTestId('result-count')).toHaveTextContent('1h 45m total');
  });

  it('applies filters from the URL', async () => {
    renderList('/activities?type=supervision');
    expect(await screen.findByRole('link', { name: /Group supervision/ })).toBeInTheDocument();
    expect(screen.queryByText('Counseling session')).not.toBeInTheDocument();
    expect(screen.getByTestId('result-count')).toHaveTextContent('Showing 1 of 2');
  });

  it('shows a helpful empty state when nothing matches', async () => {
    renderList('/activities?q=nothing-matches-this');
    expect(await screen.findByText('No activities match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Counseling session')).toBeInTheDocument();
  });

  it('filters through the search box and keeps the context in the URL', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Counseling session');
    await user.type(screen.getByLabelText('Search'), 'group');
    await waitFor(() => expect(screen.getByTestId('result-count')).toHaveTextContent('Showing 1 of 2'));
    expect(screen.queryByText('Counseling session')).not.toBeInTheDocument();
  });

  it('saves a new record through quick add', async () => {
    const user = userEvent.setup();
    const before = await activityRepository.count();
    renderList();
    await screen.findByText('Counseling session');

    await user.click(screen.getByRole('button', { name: 'Quick add' }));
    const categories = await categoryRepository.list();
    const direct = categories.find((c) => c.kind === 'direct')!;
    await user.selectOptions(document.getElementById('quick-category')!, direct.id);
    await user.type(screen.getByLabelText(/minutes/i), '30');
    await user.type(screen.getByLabelText(/^title/i), 'Progress note writing');
    await user.click(screen.getByRole('button', { name: 'Save activity' }));

    expect(await screen.findByText('Progress note writing')).toBeInTheDocument();
    await waitFor(() => expect(activityRepository.count()).resolves.toBe(before + 1));
  });

  it('blocks an invalid quick-add submission with a plain-language message', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Counseling session');
    await user.click(screen.getByRole('button', { name: 'Quick add' }));
    await user.click(screen.getByRole('button', { name: 'Save activity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a category');
  });
});
