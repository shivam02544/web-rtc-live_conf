import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('P2P Data Channel (Chat & File Transfer)', () => {
  test('Two users can connect, open chat, and send messages', async ({ browser }) => {
    // Create two isolated contexts
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();

    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    alicePage.on('console', msg => console.log('ALICE:', msg.text()));
    bobPage.on('console', msg => console.log('BOB:', msg.text()));

    // Alice registers
    await alicePage.goto('/');
    await alicePage.click('text=Create Account');
    await alicePage.fill('input[name="name"]', 'Alice Test');
    await alicePage.fill('input[name="email"]', `alice.data.${Date.now()}@example.com`);
    await alicePage.fill('input[name="password"]', 'password123');
    await alicePage.click('button[type="submit"]');
    await expect(alicePage.locator('text=Logged in as Alice Test')).toBeVisible();

    // Bob registers
    await bobPage.goto('/');
    await bobPage.click('text=Create Account');
    await bobPage.fill('input[name="name"]', 'Bob Test');
    await bobPage.fill('input[name="email"]', `bob.data.${Date.now()}@example.com`);
    await bobPage.fill('input[name="password"]', 'password123');
    await bobPage.click('button[type="submit"]');
    await expect(bobPage.locator('text=Logged in as Bob Test')).toBeVisible();

    // Alice should see Bob online
    await expect(alicePage.locator('text=Bob Test')).toBeVisible({ timeout: 25000 });
    
    // Alice calls Bob
    await alicePage.locator('li', { hasText: 'Bob Test' }).locator('button', { hasText: 'Call' }).click();
    await alicePage.click('text=Call User');
    
    // Bob accepts call
    await expect(bobPage.locator('text=Incoming video call...')).toBeVisible({ timeout: 10000 });
    await bobPage.locator('button.bg-green-600').last().click();

    // Wait for connection
    await expect(alicePage.locator('button.bg-red-600').last()).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('button.bg-red-600').last()).toBeVisible({ timeout: 10000 });

    // Both open chat panel
    await alicePage.locator('button[title="Open chat"]').click();
    await bobPage.locator('button[title="Open chat"]').click();

    // Wait for OPEN state indicator (green circle)
    await expect(alicePage.locator('span[title="OPEN"]')).toBeVisible();
    await expect(bobPage.locator('span[title="OPEN"]')).toBeVisible();

    // Alice sends a message
    await alicePage.fill('input[placeholder="Type a message..."]', 'Hello Bob, it is Alice');
    await alicePage.locator('button[type="submit"]').click();

    // Bob receives it
    await expect(bobPage.locator('text=Hello Bob, it is Alice')).toBeVisible();

    // Bob replies
    await bobPage.fill('input[placeholder="Type a message..."]', 'Hi Alice, receiving you loud and clear');
    await bobPage.locator('button[type="submit"]').click();

    // Alice receives it
    await expect(alicePage.locator('text=Hi Alice, receiving you loud and clear')).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
