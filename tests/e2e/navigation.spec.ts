import { expect, test } from '@playwright/test';
import { finishOnboarding, openApp } from './helpers';

const DESKTOP_NAV = [
  { label: 'Overview', heading: 'Overview' },
  { label: 'Activity Log', heading: 'Activity Log' },
  { label: 'Requirements', heading: 'Requirements' },
  { label: 'CEU Tracker', heading: 'CEU Tracker' },
  { label: 'Calendar', heading: 'Calendar' },
  { label: 'Reports', heading: 'Report Studio' },
] as const;

test.describe('top navigation', () => {
  test('desktop uses the horizontal header nav (never a sidebar)', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'desktop-only layout');

    await openApp(page);
    await finishOnboarding(page);

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();
    const more = page.locator('header button', { hasText: 'More' });
    await expect(more).toHaveCount(1);
    await expect(more).toBeHidden();
    // There is no sidebar landmark anywhere in the shell.
    await expect(page.locator('aside')).toHaveCount(0);

    for (const item of DESKTOP_NAV) {
      await nav.getByRole('link', { name: item.label, exact: true }).click();
      await expect(page.getByRole('heading', { name: item.heading, exact: true })).toBeVisible();
    }
  });

  test('mobile collapses the header into a More menu', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'mobile-only layout');

    await openApp(page);
    await finishOnboarding(page);

    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    const more = page.getByRole('button', { name: 'More' });
    await expect(more).toBeVisible();
    await more.click();

    const sheet = page.getByRole('navigation', { name: 'Primary mobile' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Calendar' })).toBeVisible();

    await sheet.getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Report Studio', exact: true })).toBeVisible();
    await expect(sheet).toBeHidden();
  });

  test('quick add opens the right entry forms', async ({ page }) => {
    await openApp(page);
    await finishOnboarding(page);

    await page.getByRole('button', { name: /Quick Add|Add$/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Log supervision' }).click();
    await expect(page.getByRole('heading', { name: 'Log supervision' })).toBeVisible();

    await page.getByRole('button', { name: /Quick Add|Add$/ }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Add CEU record' }).click();
    await expect(page.getByRole('heading', { name: 'Add CEU record' })).toBeVisible();
  });

  test('unknown routes render the not-found page', async ({ page }) => {
    await openApp(page);
    await finishOnboarding(page);

    await page.goto('/#/nope');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
