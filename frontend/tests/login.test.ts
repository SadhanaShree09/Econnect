import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Sign in with Google. Opens in' }).click();
  const page1 = await page1Promise;
  await page1.getByRole('textbox', { name: 'Email or phone' }).click();
  await page1.getByRole('textbox', { name: 'Email or phone' }).fill('harrine.2253020@srec.ac.in');
  await page1.getByRole('textbox', { name: 'Email or phone' }).press('Enter');
  await page1.getByRole('textbox', { name: 'Enter your password' }).fill('Harrines@123');
  await page1.getByRole('checkbox', { name: 'Show password' }).check();
  await page1.getByRole('textbox', { name: 'Enter your password' }).click();
  await page1.getByRole('textbox', { name: 'Enter your password' }).press('ArrowLeft');
  await page1.getByRole('textbox', { name: 'Enter your password' }).press('ArrowLeft');
  await page1.getByRole('textbox', { name: 'Enter your password' }).fill('Harrines@123');
  await page1.getByRole('textbox', { name: 'Enter your password' }).press('Enter');
  await page1.goto('https://accounts.google.com/gsi/transform');
});