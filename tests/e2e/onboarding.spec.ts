import { expect, test } from '@playwright/test';
import { finishOnboarding, openApp } from './helpers';

test.describe('first-run onboarding', () => {
  test('explains local storage and refuses to finish without the acknowledgement', async ({ page }) => {
    await openApp(page);

    await expect(page.getByText('there is no account and no cloud')).toBeVisible();
    await expect(page.getByText('Please do not enter client names', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Start tracking' }).click();
    await expect(page.getByRole('alert')).toContainText('Please confirm you understand where your data is stored.');
    await expect(page).toHaveURL(/#\/welcome$/);
  });

  test('finishes setup and remembers it across reloads', async ({ page }) => {
    await openApp(page);
    await finishOnboarding(page);

    await expect(page.getByText('Your workspace is empty')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/#\/welcome$/);
  });

  test('stores the optional first target as a requirement', async ({ page }) => {
    await openApp(page);
    await page.locator('#onb-name').fill('Alex');
    await page.locator('#onb-target').fill('600');
    await finishOnboarding(page);

    await expect(page.getByText('Welcome back, Alex. Here is your progress at a glance.')).toBeVisible();
    await expect(page.getByText('of 600 target')).toBeVisible();
    await expect(page.getByText('Target reached')).toHaveCount(0);
  });
});
