import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ActivityDetailPage } from './ActivityDetailPage';
import { ToastProvider } from '@/components/ui/Toast';
import { initDatabase } from '@/db/database';
import { activityRepository, categoryRepository } from '@/repositories';
import { createActivity } from '@/services/activity';

let clinicalId = '';
let supervisionId = '';

beforeAll(async () => {
  await initDatabase();
  const categories = await categoryRepository.list();
  const direct = categories.find((c) => c.kind === 'direct')!;
  const individual = categories.find((c) => c.kind === 'individual_supervision')!;

  clinicalId = await createActivity({
    type: 'clinical',
    categoryId: direct.id,
    title: 'Intake session',
    date: '2026-03-05',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    location: 'Campus clinic',
    notes: 'Non-clinical note',
  });

  supervisionId = await createActivity({
    type: 'supervision',
    categoryId: individual.id,
    title: 'Weekly supervision',
    date: '2026-03-06',
    startTime: null,
    endTime: null,
    durationMinutes: 50,
    location: null,
    notes: null,
  });
});

function renderDetail(entry: string | { pathname: string; state?: unknown }) {
  const initialEntries = typeof entry === 'string' ? [entry] : [entry];
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/activities" element={<div>activity list page</div>} />
          <Route path="/activities/:id" element={<ActivityDetailPage />} />
          <Route path="/activities/:id/edit" element={<ActivityDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('ActivityDetailPage', () => {
  it('loads the exact record for the route id', async () => {
    renderDetail(`/activities/${clinicalId}`);
    expect(await screen.findByRole('heading', { name: 'Intake session' })).toBeInTheDocument();
    expect(screen.getByText('1h (60 minutes)')).toBeInTheDocument();
    expect(screen.getByText('Campus clinic')).toBeInTheDocument();
  });

  it('opens different records consecutively without stale state', async () => {
    const first = renderDetail(`/activities/${clinicalId}`);
    await screen.findByRole('heading', { name: 'Intake session' });
    first.unmount();

    renderDetail(`/activities/${supervisionId}`);
    expect(await screen.findByRole('heading', { name: 'Weekly supervision' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Intake session' })).not.toBeInTheDocument();
  });

  it('shows a useful not-found state for a missing id', async () => {
    renderDetail('/activities/no-such-id');
    expect(await screen.findByRole('heading', { name: 'Record not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Activity Log' })).toHaveAttribute('href', '/activities');
  });

  it('returns to the list context the user came from', async () => {
    renderDetail({ pathname: `/activities/${clinicalId}`, state: { from: '/activities?type=supervision' } });
    const back = await screen.findByRole('link', { name: '← Back to list' });
    expect(back).toHaveAttribute('href', '/activities?type=supervision');
  });

  it('edits the record and preserves its id', async () => {
    const user = userEvent.setup();
    renderDetail(`/activities/${clinicalId}/edit`);

    const title = await screen.findByLabelText(/title/i);
    expect(title).toHaveValue('Intake session');

    await user.clear(title);
    await user.type(title, 'Intake session (edited)');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Intake session (edited)' })).toBeInTheDocument());

    const persisted = await activityRepository.getById(clinicalId);
    expect(persisted?.title).toBe('Intake session (edited)');
    expect(persisted?.id).toBe(clinicalId);
    expect(persisted?.durationMinutes).toBe(60);
  });

  it('requires a title before saving', async () => {
    const user = userEvent.setup();
    renderDetail(`/activities/${supervisionId}/edit`);
    const title = await screen.findByLabelText(/title/i);
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Give this activity a short title.')).toBeInTheDocument();
    expect((await activityRepository.getById(supervisionId))?.title).toBe('Weekly supervision');
  });

  it('cancels editing without changing the record', async () => {
    const user = userEvent.setup();
    renderDetail(`/activities/${supervisionId}/edit`);
    const title = await screen.findByLabelText(/title/i);
    await user.clear(title);
    await user.type(title, 'Never saved');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Weekly supervision' })).toBeInTheDocument();
    expect((await activityRepository.getById(supervisionId))?.title).toBe('Weekly supervision');
  });

  it('deletes the record after confirmation', async () => {
    const user = userEvent.setup();
    const tempId = await createActivity({
      type: 'clinical',
      categoryId: null,
      title: 'Temporary record',
      date: '2026-03-07',
      startTime: null,
      endTime: null,
      durationMinutes: 15,
      location: null,
      notes: null,
    });

    renderDetail(`/activities/${tempId}`);
    await screen.findByRole('heading', { name: 'Temporary record' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('activity list page')).toBeInTheDocument();
    await waitFor(() => expect(activityRepository.getById(tempId)).resolves.toBeUndefined());
  });
});
