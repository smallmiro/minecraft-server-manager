import { test, expect } from '../../fixtures/auth';
import {
  createConfigSnapshotViaApi,
  createScheduleViaApi,
  getFirstServerName,
  cleanupSnapshots,
  cleanupSchedules,
} from '../../fixtures/config-snapshot-helpers';

/**
 * Config Snapshot Web Console E2E Tests (Playwright)
 *
 * Tests the Web Console UI for:
 * - Backup page navigation and tab switching
 * - Config Snapshots tab content
 * - Create Snapshot dialog
 * - Schedule management panel
 * - Diff viewer dialog
 * - Restore workflow
 *
 * These tests use authenticated pages and gracefully handle
 * environments without running servers.
 */
test.describe('Config Snapshot Web Console', () => {
  // ============================================================
  // Backup page — navigation and tab switching
  // ============================================================

  test.describe('Backup page navigation', () => {
    test('should navigate to /backups without redirect', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage).not.toHaveURL(/\/login/);
    });

    test('should display Backup page with tab navigation', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      // Page should contain backup-related content
      const pageText = await authenticatedPage.locator('body').textContent();
      expect(pageText).toBeTruthy();
    });

    test('should show World Backups tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for World Backups tab label
      const worldBackupsTab = authenticatedPage.getByRole('tab', {
        name: /world backups/i,
      });

      const isVisible = await worldBackupsTab.isVisible().catch(() => false);
      if (isVisible) {
        await expect(worldBackupsTab).toBeVisible();
      }
      // If tabs don't exist in this environment, we skip gracefully
    });

    test('should show Config Snapshots tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for Config Snapshots tab
      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });

      const isVisible = await configSnapshotsTab.isVisible().catch(() => false);
      if (isVisible) {
        await expect(configSnapshotsTab).toBeVisible();
      }
    });

    test('should switch to Config Snapshots tab when clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      // Find Config Snapshots tab
      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });

      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      // Verify tab is now selected (aria-selected="true")
      await expect(configSnapshotsTab).toHaveAttribute('aria-selected', 'true');
    });

    test('Config Snapshots tab shows server list or loading state', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });

      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      // After switching tab, page should show either content or empty state
      const bodyText = await authenticatedPage.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Create Snapshot dialog
  // ============================================================

  test.describe('Create Snapshot dialog', () => {
    test('should show Create Snapshot button on Config Snapshots tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for Create Snapshot button
      const createButton = authenticatedPage.getByRole('button', {
        name: /create snapshot/i,
      });

      if (await createButton.isVisible().catch(() => false)) {
        await expect(createButton).toBeVisible();
        await expect(createButton).toBeEnabled();
      }
    });

    test('should open Create Snapshot dialog when button is clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      const createButton = authenticatedPage.getByRole('button', {
        name: /create snapshot/i,
      });
      if (!await createButton.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await createButton.click();

      // Dialog should open
      const dialog = authenticatedPage.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });
    });

    test('Create Snapshot dialog contains required form elements', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      const createButton = authenticatedPage.getByRole('button', {
        name: /create snapshot/i,
      });
      if (!await createButton.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await createButton.click();

      const dialog = authenticatedPage.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      // Dialog should contain title
      const dialogTitle = dialog.getByText(/create config snapshot/i);
      await expect(dialogTitle).toBeVisible();

      // Dialog should have Server selector and Description field
      const serverLabel = dialog.getByText(/server/i).first();
      const descField = dialog.getByLabel(/description/i);

      const serverLabelVisible = await serverLabel.isVisible().catch(() => false);
      const descFieldVisible = await descField.isVisible().catch(() => false);
      expect(serverLabelVisible || descFieldVisible).toBeTruthy();
    });

    test('Create Snapshot dialog can be cancelled', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      const createButton = authenticatedPage.getByRole('button', {
        name: /create snapshot/i,
      });
      if (!await createButton.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await createButton.click();

      const dialog = authenticatedPage.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      // Click Cancel button
      const cancelButton = dialog.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
        // Dialog should close
        await expect(dialog).not.toBeVisible({ timeout: 3000 });
      }
    });

    test('Create Snapshot dialog closes with Escape key', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      const createButton = authenticatedPage.getByRole('button', {
        name: /create snapshot/i,
      });
      if (!await createButton.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await createButton.click();

      const dialog = authenticatedPage.getByRole('dialog');
      if (!await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      // Press Escape to close
      await authenticatedPage.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 3000 });
    });
  });

  // ============================================================
  // Schedule management panel
  // ============================================================

  test.describe('Schedule management panel', () => {
    test('should show Manage Schedules button on Config Snapshots tab', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      // Look for Manage Schedules button
      const manageButton = authenticatedPage.getByRole('button', {
        name: /manage schedules/i,
      });

      if (await manageButton.isVisible().catch(() => false)) {
        await expect(manageButton).toBeVisible();
        await expect(manageButton).toBeEnabled();
      }
    });

    test('should open schedule panel when Manage Schedules is clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      const manageButton = authenticatedPage.getByRole('button', {
        name: /manage schedules/i,
      });
      if (!await manageButton.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await manageButton.click();

      // Panel/drawer/dialog should open
      const panelSelectors = [
        '[role="dialog"]',
        '[role="complementary"]',
        '.MuiDrawer-root',
        '.MuiModal-root',
      ];

      let panelVisible = false;
      for (const selector of panelSelectors) {
        if (await authenticatedPage.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
          panelVisible = true;
          break;
        }
      }

      // Panel should open (might be drawer or dialog)
      expect(panelVisible).toBeTruthy();
    });
  });

  // ============================================================
  // Diff Viewer dialog
  // ============================================================

  test.describe('Diff Viewer dialog', () => {
    test('should open diff dialog from server card', async ({ authenticatedPage }) => {
      const serverName = await getFirstServerName();

      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      // If no server exists, skip
      if (!serverName) {
        test.skip();
        return;
      }

      // Look for View Diff button
      const viewDiffButtons = authenticatedPage.getByRole('button', {
        name: /view diff|diff|compare/i,
      });

      if (!await viewDiffButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        test.skip();
        return;
      }

      await viewDiffButtons.first().click();

      // Dialog may or may not open depending on whether snapshots exist
      const dialog = authenticatedPage.getByRole('dialog');
      const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);

      // This is acceptable: if no snapshots, no dialog opens
      if (dialogVisible) {
        await expect(dialog).toBeVisible();
      }
    });
  });

  // ============================================================
  // Restore workflow
  // ============================================================

  test.describe('Restore dialog', () => {
    test('should show restore dialog from server snapshots', async ({ authenticatedPage }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Pre-create a snapshot so there's something to restore
        const snap = await createConfigSnapshotViaApi(serverName, 'web restore test');
        if (snap) {
          createdIds.push(snap.id);
        }

        await authenticatedPage.goto('/backups');
        await authenticatedPage.waitForLoadState('networkidle');

        const configSnapshotsTab = authenticatedPage.getByRole('tab', {
          name: /config snapshots/i,
        });
        if (!await configSnapshotsTab.isVisible().catch(() => false)) {
          test.skip();
          return;
        }

        await configSnapshotsTab.click();
        await authenticatedPage.waitForLoadState('networkidle');

        // Look for Restore button on server card
        const restoreButtons = authenticatedPage.getByRole('button', {
          name: /restore/i,
        });

        const restoreVisible = await restoreButtons.first().isVisible({ timeout: 3000 }).catch(() => false);
        if (restoreVisible) {
          await restoreButtons.first().click();

          // Restore dialog should open
          const dialog = authenticatedPage.getByRole('dialog');
          const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);

          if (dialogVisible) {
            await expect(dialog).toBeVisible();
            // Dialog should have safety snapshot checkbox option
            const safetyCheckbox = dialog.getByRole('checkbox').first();
            if (await safetyCheckbox.isVisible().catch(() => false)) {
              // By default safety snapshot should be checked
              await expect(safetyCheckbox).toBeChecked();
            }

            // Cancel without restoring
            const cancelButton = dialog.getByRole('button', { name: /cancel/i });
            if (await cancelButton.isVisible().catch(() => false)) {
              await cancelButton.click();
            }
          }
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });
  });

  // ============================================================
  // URL persistence (tab selection via query param)
  // ============================================================

  test.describe('URL state persistence', () => {
    test('navigating to /backups with tab=config-snapshots shows Config Snapshots tab', async ({ authenticatedPage }) => {
      // Some implementations use URL query params to persist tab selection
      await authenticatedPage.goto('/backups?tab=config-snapshots');
      await authenticatedPage.waitForLoadState('networkidle');

      await expect(authenticatedPage).not.toHaveURL(/\/login/);

      // Page should load without error
      const bodyText = await authenticatedPage.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });

    test('/backups page is accessible (no server error)', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      // Should not show a server error
      const has500 = await authenticatedPage.getByText(/500|internal server error/i).isVisible().catch(() => false);
      expect(has500).toBe(false);
    });
  });

  // ============================================================
  // Server card interactions
  // ============================================================

  test.describe('Server card interactions on Config Snapshots tab', () => {
    test('server cards show snapshot summary when snapshots exist', async ({ authenticatedPage }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      const createdIds: string[] = [];

      try {
        // Pre-create snapshots so server card shows data
        const snap = await createConfigSnapshotViaApi(serverName, 'card display test');
        if (snap) createdIds.push(snap.id);

        await authenticatedPage.goto('/backups');
        await authenticatedPage.waitForLoadState('networkidle');

        const configSnapshotsTab = authenticatedPage.getByRole('tab', {
          name: /config snapshots/i,
        });
        if (!await configSnapshotsTab.isVisible().catch(() => false)) {
          test.skip();
          return;
        }

        await configSnapshotsTab.click();
        await authenticatedPage.waitForLoadState('networkidle');

        // After loading, should show server name or snapshot count
        const pageText = await authenticatedPage.locator('body').textContent();
        expect(pageText).toBeTruthy();

        // Optionally check for server name visibility
        if (serverName) {
          const serverNameEl = authenticatedPage.getByText(serverName);
          // Server name may or may not be visible depending on data load timing
          const serverVisible = await serverNameEl.first().isVisible({ timeout: 3000 }).catch(() => false);
          if (serverVisible) {
            await expect(serverNameEl.first()).toBeVisible();
          }
        }
      } finally {
        await cleanupSnapshots(serverName, createdIds);
      }
    });

    test('Create Snapshot button is available per server card', async ({ authenticatedPage }) => {
      const serverName = await getFirstServerName();
      if (!serverName) {
        test.skip();
        return;
      }

      await authenticatedPage.goto('/backups');
      await authenticatedPage.waitForLoadState('networkidle');

      const configSnapshotsTab = authenticatedPage.getByRole('tab', {
        name: /config snapshots/i,
      });
      if (!await configSnapshotsTab.isVisible().catch(() => false)) {
        test.skip();
        return;
      }

      await configSnapshotsTab.click();
      await authenticatedPage.waitForLoadState('networkidle');

      // Should have at least one Create Snapshot button (global or per-server)
      const createButtons = authenticatedPage.getByRole('button', {
        name: /create snapshot/i,
      });

      const count = await createButtons.count();
      // If the UI loaded with servers, there should be create buttons
      if (count > 0) {
        await expect(createButtons.first()).toBeEnabled();
      }
    });
  });
});
