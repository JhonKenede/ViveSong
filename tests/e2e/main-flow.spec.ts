import { expect, test } from '@playwright/test';

test('main worship workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Selecciona una cancion/i })).toBeVisible();

  await page.getByLabel('Buscar canciones').fill('roca');
  await expect(page.getByRole('button', { name: /Firme roca/i })).toBeVisible();
  await page.getByRole('button', { name: /Firme roca/i }).click();
  await expect(page.getByRole('heading', { name: /Firme roca/i })).toBeVisible();
  await page.getByRole('button', { name: /Biblioteca/i }).first().click();

  await page.getByRole('button', { name: /Repertorios/i }).click();
  await page.getByRole('button', { name: /Abrir directo/i }).click();

  await expect(page.getByRole('heading', { name: /Luz en mi camino/i })).toBeVisible();
  await page.getByRole('button', { name: /Siguiente/i }).click();
  await expect(page.getByRole('heading', { name: /Cerca de tu mesa/i })).toBeVisible();
});
