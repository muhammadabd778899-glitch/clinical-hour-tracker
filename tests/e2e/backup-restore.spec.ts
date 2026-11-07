import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { finishOnboarding, logActivity, openApp } from './helpers';

test.describe('backup and restore', () => {
  test('downloads a backup, erases the device, then restores from that file', async ({ page }, testInfo) => {
    await openApp(page);
    await finishOnboarding(page);
    await logActivity(page, { title: 'Backup probe', durationMinutes: 45 });

    await page.goto('/#/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full backup (JSON)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^clinical-tracker-backup-.*\.json$/);
    const backupPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(backupPath);

    // Wipe the device so the restore has something real to recover.
    await page.getByRole('button', { name: 'Erase all data on this device' }).click();
    const eraseDialog = page.getByRole('dialog');
    await expect(eraseDialog).toContainText('permanently deleted');
    await eraseDialog.getByRole('button', { name: 'Erase all data' }).click();

    await expect(page.getByRole('heading', { name: 'Welcome to All in One Clinical Tracker' })).toBeVisible();
    await finishOnboarding(page);
    await expect(page.getByText('Your workspace is empty')).toBeVisible();

    await page.goto('/#/settings');
    await page.locator('#restore-file').setInputFiles(backupPath);

    const preview = page.getByRole('dialog', { name: 'Restore preview' });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Nothing has been changed yet.');
    await expect(preview).toContainText('Activities:');
    await expect(preview).toContainText('Backup created');
    await preview.getByRole('button', { name: 'Restore now' }).click();

    await expect(page.locator('[role="status"]').filter({ hasText: 'Restore complete: 1 activities' })).toBeVisible();

    await page.goto('/#/activities');
    await expect(page.getByText('Backup probe')).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('1 of 1 activities');
  });

  test('merge mode keeps local records that the backup does not contain', async ({ page }, testInfo) => {
    await openApp(page);
    await finishOnboarding(page);
    await logActivity(page, { title: 'Old record', durationMinutes: 30 });

    await page.goto('/#/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full backup (JSON)' }).click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(backupPath);

    await logActivity(page, { title: 'Local-only record', durationMinutes: 15 });

    await page.goto('/#/settings');
    await page.locator('#restore-file').setInputFiles(backupPath);
    const preview = page.getByRole('dialog', { name: 'Restore preview' });
    await expect(preview).toBeVisible();
    await preview.getByRole('radio', { name: /Merge with existing data/ }).check();
    await preview.getByRole('button', { name: 'Restore now' }).click();
    await expect(page.locator('[role="status"]').filter({ hasText: 'Restore complete' })).toBeVisible();

    await page.goto('/#/activities');
    await expect(page.getByText('Old record')).toBeVisible();
    await expect(page.getByText('Local-only record')).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('2 of 2 activities');
  });

  test('rejects a file that is not a backup and leaves the data untouched', async ({ page }, testInfo) => {
    await openApp(page);
    await finishOnboarding(page);
    await logActivity(page, { title: 'Keep me', durationMinutes: 20 });

    const badFile = testInfo.outputPath('not-a-backup.json');
    await writeFile(badFile, JSON.stringify({ hello: 'world' }), 'utf8');

    await page.goto('/#/settings');
    await page.locator('#restore-file').setInputFiles(badFile);
    await expect(page.getByRole('alert')).toContainText('not created by All in One Clinical Tracker');

    await page.goto('/#/activities');
    await expect(page.getByText('Keep me')).toBeVisible();
    await expect(page.getByTestId('result-count')).toContainText('1 of 1 activities');
  });
});
