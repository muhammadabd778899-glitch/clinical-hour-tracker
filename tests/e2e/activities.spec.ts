import { expect, test } from '@playwright/test';
import { finishOnboarding, logActivity, openApp } from './helpers';

test.describe('activity lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await finishOnboarding(page);
  });

  test('creates a record and keeps it after a hard refresh', async ({ page }) => {
    const url = await logActivity(page, { title: 'Intake session', durationMinutes: 90 });

    await expect(page.getByText('1h 30m', { exact: true })).toBeVisible();
    await expect(page.getByText('(90 minutes)')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Intake session' })).toBeVisible();
    expect(new URL(page.url()).hash).toBe(`#${url}`);
  });

  test('lists the record, searches it and shows the running total', async ({ page }) => {
    await logActivity(page, { title: 'Intake session', durationMinutes: 90 });
    await logActivity(page, { title: 'Case conference', durationMinutes: 45 });

    await page.goto('/#/activities');
    await expect(page.getByTestId('result-count')).toContainText('2 of 2 activities');

    await page.locator('#filter-q').fill('conference');
    await expect(page.getByTestId('result-count')).toContainText('Showing 1 of 2');
    await expect(page.getByText('Case conference')).toBeVisible();
    await expect(page.getByText('Intake session')).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page.getByTestId('result-count')).toContainText('2 of 2 activities');
  });

  test('edits through the detail route without stale state', async ({ page }) => {
    const url = await logActivity(page, { title: 'Documentation block', durationMinutes: 30 });

    await page.goto(`/#${url}`);
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit activity' })).toBeVisible();

    await page.locator('#activity-title').fill('Documentation block (updated)');
    await page.locator('#activity-duration').fill('45');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('heading', { name: 'Documentation block (updated)' })).toBeVisible();
    await expect(page.getByText('(45 minutes)')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Documentation block (updated)' })).toBeVisible();
    await expect(page.getByText('(30 minutes)')).toHaveCount(0);
  });

  test('deletes a record and returns to the log', async ({ page }) => {
    await logActivity(page, { title: 'Temporary record', durationMinutes: 15 });

    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Temporary record');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page).toHaveURL(/#\/activities$/);
    await expect(page.getByText('No activities yet')).toBeVisible();
  });

  test('shows a not-found state for an unknown record id', async ({ page }) => {
    await page.goto('/#/activities/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Record not found' })).toBeVisible();
    await expect(page.getByText('This activity does not exist on this device.')).toBeVisible();
    await page.getByRole('link', { name: 'Back to Activity Log' }).click();
    await expect(page).toHaveURL(/#\/activities$/);
  });

  test('derives the duration from the entered start and end times', async ({ page }) => {
    await page.goto('/#/activities/new?type=clinical');
    await page.locator('#activity-title').fill('Timed session');
    await page.locator('#activity-category').selectOption({ label: 'Direct client work' });
    await page.locator('#activity-start').fill('09:00');
    await page.locator('#activity-end').fill('10:30');

    await expect(page.locator('#activity-duration')).toHaveValue('90');
    await page.getByRole('button', { name: 'Save activity' }).click();

    await expect(page.getByRole('heading', { name: 'Timed session' })).toBeVisible();
    await expect(page.getByText('(90 minutes)')).toBeVisible();
  });

  test('rejects an end time that is before the start time', async ({ page }) => {
    await page.goto('/#/activities/new?type=clinical');
    await page.locator('#activity-title').fill('Backwards times');
    await page.locator('#activity-category').selectOption({ label: 'Direct client work' });
    await page.locator('#activity-start').fill('10:30');
    await page.locator('#activity-end').fill('09:00');
    await page.locator('#activity-duration').fill('60');
    await page.getByRole('button', { name: 'Save activity' }).click();

    await expect(page.getByText('The end time must be after the start time.')).toBeVisible();
    await expect(page).toHaveURL(/#\/activities\/new/);
  });
});
