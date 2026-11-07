import { expect, type Page } from '@playwright/test';

/** Opens the app root — a fresh browser profile always starts on the welcome screen. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to All in One Clinical Tracker' })).toBeVisible();
}

/** Completes the first-run acknowledgement and lands on the Overview. */
export async function finishOnboarding(page: Page): Promise<void> {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}

export interface ActivityInput {
  title: string;
  durationMinutes?: number;
  categoryLabel?: string;
  date?: string;
}

/**
 * Loads a hash route with a real document load (`/#/activities`), so the test
 * exercises the same boot path a refresh or a shared link would.
 */
export async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route.startsWith('/') ? route : `/${route}`}`);
}

/** Creates an activity through the full entry form and returns its detail URL. */
export async function logActivity(page: Page, input: ActivityInput): Promise<string> {
  await gotoRoute(page, '/activities/new?type=clinical');
  await expect(page.getByRole('heading', { name: 'Log an activity' })).toBeVisible();

  await page.locator('#activity-title').fill(input.title);
  await page
    .locator('#activity-category')
    .selectOption({ label: input.categoryLabel ?? 'Direct client work' });
  if (input.date) await page.locator('#activity-date').fill(input.date);
  await page.locator('#activity-duration').fill(String(input.durationMinutes ?? 60));
  await page.getByRole('button', { name: 'Save activity' }).click();

  await expect(page.getByRole('heading', { name: input.title })).toBeVisible();
  return new URL(page.url()).hash.replace(/^#/, '');
}

/** Waits until the app's service worker controls the page. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 5000);
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            window.clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    }
    return registration;
  });
}
