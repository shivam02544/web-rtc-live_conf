import { test, expect } from '@playwright/test';

test.describe('P2P Video Call Flow', () => {
  test('Two users can register, see each other online, and connect a call', async ({ browser }) => {
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
    await alicePage.fill('input[name="email"]', `alice.${Date.now()}@example.com`);
    await alicePage.fill('input[name="password"]', 'password123');
    await alicePage.click('button[type="submit"]');
    await expect(alicePage.locator('text=Logged in as Alice Test')).toBeVisible();

    // Bob registers
    await bobPage.goto('/');
    await bobPage.click('text=Create Account');
    await bobPage.fill('input[name="name"]', 'Bob Test');
    await bobPage.fill('input[name="email"]', `bob.${Date.now()}@example.com`);
    await bobPage.fill('input[name="password"]', 'password123');
    await bobPage.click('button[type="submit"]');
    await expect(bobPage.locator('text=Logged in as Bob Test')).toBeVisible();

    // Alice should see Bob online
    await expect(alicePage.locator('text=Bob Test')).toBeVisible({ timeout: 25000 });
    
    // Alice calls Bob
    await alicePage.locator('li', { hasText: 'Bob Test' }).locator('button', { hasText: 'Call' }).click(); // Select user
    await alicePage.click('text=Call User'); // Start call
    
    // Bob should see incoming call
    await expect(bobPage.locator('text=Incoming video call...')).toBeVisible({ timeout: 10000 });
    
    // Bob accepts call
    // Wait, the page has "Call User" which is also green-600 but hidden or not? 
    // Let's use aria-label or just locate by SVG.
    await bobPage.locator('button.bg-green-600').last().click();

    // Both should see Connected state
    // We can check if the video elements have a srcObject in the DOM, or just check the End Call button appears
    await expect(alicePage.locator('button.bg-red-600').last()).toBeVisible({ timeout: 10000 });
    await expect(bobPage.locator('button.bg-red-600').last()).toBeVisible({ timeout: 10000 });

    // Wait a bit to simulate the call
    await alicePage.waitForTimeout(3000);

    // Alice ends the call
    await alicePage.locator('button.bg-red-600').last().click();

    // Both should return to IDLE
    await expect(alicePage.locator('text=Select a user to call')).toBeVisible();
    await expect(bobPage.locator('text=Select a user to call')).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
