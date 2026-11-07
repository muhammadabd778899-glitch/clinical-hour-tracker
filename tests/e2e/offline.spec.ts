import { expect, test } from '@playwright/test';
import { finishOnboarding, logActivity, openApp, waitForServiceWorker } from './helpers';

test.describe('offline behaviour', () => {
  test('shows the offline badge and keeps saving records without a network', async ({ page, context }) => {
    await openApp(page);
    await finishOnboarding(page);
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await expect(page.locator('header').getByText('Offline', { exact: true })).toBeVisible();

    await logActivity(page, { title: 'Offline entry', durationMinutes: 25 });
    await page.goto('/#/activities');
    await expect(page.getByText('Offline entry')).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('1 of 1 activities');

    await context.setOffline(false);
    await expect(page.locator('header').getByText('Offline', { exact: true })).toBeHidden();
  });

  test('reloads from the service worker while every network request is blocked', async ({ page, context }) => {
    await openApp(page);
    await finishOnboarding(page);
    await waitForServiceWorker(page);

    // Block every request the page could make directly; only a service worker
    // can answer the reload below.
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
    await context.setOffline(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page.getByText('Let’s get you started')).toBeVisible();

    await context.unroute('**/*');
    await context.setOffline(false);
  });
});
