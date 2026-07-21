import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function mockProfiles(page: Page): Promise<void> {
  await page.route('**/api/drivers', async (route) =>
    route.fulfill({ json: { drivers: [] } }),
  );
  await page.route('**/api/equipment/tractors', async (route) =>
    route.fulfill({ json: { tractors: [] } }),
  );
  await page.route('**/api/equipment/trailers', async (route) =>
    route.fulfill({ json: { trailers: [] } }),
  );
  await page.route('**/api/equipment/loads', async (route) =>
    route.fulfill({ json: { loads: [] } }),
  );
}

test('completes the responsive setup interactions without hidden horizontal overflow', async ({
  page,
}) => {
  await mockProfiles(page);
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /build the trip before the road builds problems/iu,
    }),
  ).toBeVisible();

  await page.getByLabel(/bearer token/iu).fill('browser-session-token');
  await page.getByRole('button', { name: /load profiles/iu }).click();
  await expect(
    page.getByText(/connected to authenticated carrier account/iu),
  ).toBeVisible();

  await page.getByRole('button', { name: /add stop/iu }).click();
  await page.getByRole('button', { name: /add stop/iu }).click();
  await expect(page.locator('.stop-card')).toHaveCount(4);

  const locations = page.getByLabel('Location name');
  await locations.nth(1).fill('Alpha intermediate');
  await locations.nth(2).fill('Beta intermediate');
  await page.getByRole('button', { name: /move stop 2 later/iu }).click();

  const headings = await page.locator('.stop-card h3').allTextContents();
  expect(headings).toEqual([
    'Start location',
    'Beta intermediate',
    'Alpha intermediate',
    'Final consignee',
  ]);

  await page.getByRole('button', { name: /save and calculate trip/iu }).click();
  await expect(
    page.getByText(/correct the blocking setup errors before calculation/iu),
  ).toBeVisible();

  await page.waitForTimeout(800);
  const persisted = await page.evaluate(() =>
    localStorage.getItem('trip-route-calc.stage18.draft.v1'),
  );
  expect(persisted).not.toContain('browser-session-token');

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(noHorizontalOverflow).toBe(true);
});
