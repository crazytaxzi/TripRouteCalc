// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';
import { DRAFT_STORAGE_KEY, defaultTripDraft, saveDraft } from './model.js';

describe('Stage 18 mobile trip setup UI', () => {
  it('renders the complete setup sequence and blocks invalid submission locally', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /build the trip before the road builds problems/iu,
      }),
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: /driver and departure HOS/iu })).toBeDefined();
    expect(screen.getByRole('heading', { name: /tractor and trailer/iu })).toBeDefined();
    expect(screen.getByRole('heading', { name: /load and weight evidence/iu })).toBeDefined();
    expect(screen.getByRole('heading', { name: /ordered stops/iu })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /save and calculate trip/iu }));

    expect(
      screen.getByText(/correct the blocking setup errors before calculation/iu),
    ).toBeDefined();
    expect(screen.getByText(/select or name the driver/iu)).toBeDefined();
  });

  it('adds and removes intermediate stops without exposing locked endpoint controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByRole('article')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /add stop/iu }));
    await user.click(screen.getByRole('button', { name: /add stop/iu }));
    expect(screen.getAllByRole('article')).toHaveLength(4);

    const removeButtons = screen.getAllByRole('button', { name: /remove stop/iu });
    expect(removeButtons[0]?.hasAttribute('disabled')).toBe(true);
    expect(removeButtons.at(-1)?.hasAttribute('disabled')).toBe(true);
    expect(removeButtons[1]?.hasAttribute('disabled')).toBe(false);

    if (removeButtons[1] === undefined) throw new Error('Missing intermediate remove control.');
    await user.click(removeButtons[1]);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('restores local work without persisting the bearer token in the draft', async () => {
    const saved = {
      ...defaultTripDraft(),
      driver: { displayName: 'Recovered Driver' },
    };
    saveDraft(saved);
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(/saved setup found/iu)).toBeDefined();
    await user.click(screen.getByRole('button', { name: /restore draft/iu }));
    expect(screen.getByDisplayValue('Recovered Driver')).toBeDefined();

    const token = screen.getByLabelText(/bearer token/iu);
    await user.type(token, 'session-secret-token');
    const driver = screen.getByLabelText(/driver name or identifier/iu);
    await user.clear(driver);
    await user.type(driver, 'Changed Driver');

    await waitFor(
      () => {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        expect(raw).not.toBeNull();
        expect(raw).not.toContain('session-secret-token');
      },
      { timeout: 2_000 },
    );
  });
});
