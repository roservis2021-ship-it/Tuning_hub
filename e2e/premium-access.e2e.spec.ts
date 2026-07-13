import { expect, test } from '@playwright/test';

test('la portada y el acceso de cuenta se adaptan sin desbordamiento', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Descubre una guia especifica/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifica tu coche' })).toBeVisible();
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear una cuenta' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'He olvidado mi contraseña' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Premium exige sesión y no permite registrarse antes del pago', async ({ page }) => {
  await page.goto('/?premium_preview=330ci-qa-20260711');
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear una cuenta' })).toHaveCount(0);
  await expect(page.getByText('Tu garaje Premium')).toBeVisible();
});

test('la recuperación informa del error de red sin perder el formulario', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await page.getByRole('button', { name: 'He olvidado mi contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Recupera el acceso' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill('e2e-network@tuninghub.invalid');
  await page.route('https://identitytoolkit.googleapis.com/**', (route) => route.abort('internetdisconnected'));
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo conectar', { timeout: 15_000 });
});

test('el backend rechaza el acceso administrativo sin autenticación', async ({ request }) => {
  const response = await request.get('http://127.0.0.1:8788/api/admin/resources/users');
  expect(response.status()).toBe(401);
});
