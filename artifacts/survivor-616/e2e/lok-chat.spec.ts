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
    await expect.poll(() => page.getByTestId('lok-chat-message-theirs').count(), { timeout: 8000 }).toBeGreaterThanOrEqual(1);

    // A suggestion sends its own text and is answered too.
    await page.getByTestId('lok-chat-quick-work').click();
    await expect(page.getByTestId('lok-chat-message-mine')).toHaveCount(2);
    await expect.poll(() => page.getByTestId('lok-chat-message-theirs').count(), { timeout: 8000 }).toBeGreaterThanOrEqual(2);
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
    await expect.poll(() => page.getByTestId('lok-chat-message-theirs').count(), { timeout: 8000 }).toBeGreaterThanOrEqual(1);
    await page.keyboard.press('Escape');
    // The store is saved shortly after a change and on page hide.
    await page.waitForTimeout(700);

    await page.reload();
    await page.getByTestId('button-lok-chat').click();
    await page.getByTestId('lok-chat-row-deacon').click();
    await expect(page.getByTestId('lok-chat-message-mine')).toHaveCount(1);
    await expect.poll(() => page.getByTestId('lok-chat-message-theirs').count(), { timeout: 8000 }).toBeGreaterThanOrEqual(1);

    // Clear wipes the conversation (after a confirmation).
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('button-lok-chat-clear').click();
    await expect(page.getByTestId('lok-chat-message-mine')).toHaveCount(0);
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

  test('it follows on: a feeling gets an answer, "why" goes deeper, and a question back takes a yes', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/?screen=hub');
    await page.getByTestId('button-lok-chat').click();
    await page.getByTestId('lok-chat-row-mamajo').click();

    const send = async (text: string, expectTheirs: number) => {
      await page.getByTestId('lok-chat-input').fill(text);
      await page.keyboard.press('Enter');
      await expect.poll(() => page.getByTestId('lok-chat-message-theirs').count(), { timeout: 8000 }).toBeGreaterThanOrEqual(expectTheirs);
    };
    await send('i am so tired', 1);
    await expect(page.getByTestId('lok-chat-thread')).not.toContainText(/not sure what you mean|you lost me/i);
    await send('tell me about the kitchen', 2);
    await expect(page.getByTestId('lok-chat-thread')).toContainText(/salt and patience|cast iron/i);
    await send('why', 3);
    // A stranger gets the held-back layer politely, and a new thing to ask about.
    await expect(page.getByTestId('lok-chat-thread')).toContainText(/another chapter|know each other|keep stopping by|ask me again/i);
  });
});
