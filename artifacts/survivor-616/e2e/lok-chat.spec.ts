import { expect, test } from '@playwright/test';

const meta = (extra: Record<string, unknown> = {}) => JSON.stringify({
  version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, starterLokPetOnboardingComplete: true, hideoutEvents: 'off',
  rescuedAllyIds: ['vee', 'deacon', 'mamajo'],
  ...extra,
});

test.describe('LOK Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((m) => {
      if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m);
    }, meta());
  });

  test('you can message a crew member, tap a suggestion, and get answers in their voice', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/?screen=hub');
    await page.getByTestId('button-lok-chat').click();
    await expect(page.getByRole('dialog', { name: 'LOK Chat' })).toBeVisible();

    await page.getByTestId('lok-chat-row-vee').click();
    await page.getByTestId('lok-chat-input').fill('how are you?');
    await page.getByTestId('lok-chat-send').click();
    await expect(page.getByTestId('lok-chat-message-mine')).toHaveCount(1);
    await expect(page.getByTestId('lok-chat-message-theirs')).toHaveCount(1, { timeout: 6000 });

    // A suggestion sends its own text and is answered too.
    await page.getByTestId('lok-chat-quick-work').click();
    await expect(page.getByTestId('lok-chat-message-mine')).toHaveCount(2);
    await expect(page.getByTestId('lok-chat-message-theirs')).toHaveCount(2, { timeout: 6000 });
    await expect(page.getByTestId('lok-chat-thread')).toContainText(/corner store owner/i);

    // Their relationship with other crew shows up when you ask.
    await page.getByTestId('lok-chat-input').fill('what do you think of mama jo?');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('lok-chat-thread')).toContainText(/good pan/i, { timeout: 6000 });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lok-chat')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('conversations persist on this device across a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/?screen=hub');
    await page.getByTestId('button-lok-chat').click();
    await page.getByTestId('lok-chat-row-deacon').click();
    await page.getByTestId('lok-chat-input').fill('hello');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('lok-chat-message-theirs')).toHaveCount(1, { timeout: 6000 });
    await page.keyboard.press('Escape');
    // The store is saved shortly after a change and on page hide.
    await page.waitForTimeout(700);

    await page.reload();
    await page.getByTestId('button-lok-chat').click();
    await page.getByTestId('lok-chat-row-deacon').click();
    await expect(page.getByTestId('lok-chat-message-mine')).toHaveCount(1);
    await expect(page.getByTestId('lok-chat-message-theirs')).toHaveCount(1);
  });

  test('on a phone the chat list and the conversation take turns', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?screen=hub');
    await page.getByTestId('button-lok-chat').click();
    await expect(page.getByTestId('lok-chat-input')).toBeVisible();
    await page.getByRole('button', { name: 'Back to chats' }).click();
    await expect(page.getByTestId('lok-chat-row-mamajo')).toBeVisible();
    await page.getByTestId('lok-chat-row-mamajo').click();
    await expect(page.getByTestId('lok-chat-input')).toBeVisible();
  });
});
