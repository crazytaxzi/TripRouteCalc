// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';
import { DRAFT_STORAGE_KEY, defaultTripDraft, saveDraft } from './model.js';

describe('Stage 18 mobile trip setup UI', () => {
  it('renders the complete sequence, blocks invalid submission, and focuses the first blocker', async () => {
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

    const driver = screen.getByLabelText(/driver name or identifier/iu);
    await user.click(screen.getByRole('button', { name: /save and calculate trip/iu }));

    expect(
      screen.getByText(/correct the blocking setup errors before calculation/iu),
    ).toBeDefined();
    expect(screen.getByText(/select or name the driver/iu)).toBeDefined();
    expect(document.activeElement).toBe(driver);
  });

  it('protects endpoints and supports add, duplicate, insert, lock, optional, and remove controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByRole('article')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /^add stop$/iu }));
    expect(screen.getAllByRole('article')).toHaveLength(3);

    const endpointRemoveButtons = screen.getAllByRole('button', {
      name: /remove stop/iu,
    });
    expect(endpointRemoveButtons[0]?.hasAttribute('disabled')).toBe(true);
    expect(endpointRemoveButtons.at(-1)?.hasAttribute('disabled')).toBe(true);

    await user.click(
      screen.getByRole('button', { name: /duplicate stop 2/iu }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(4);

    await user.click(
      screen.getByRole('button', { name: /insert stop after stop 2/iu }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(5);

    const secondCard = screen.getAllByRole('article')[1];
    if (secondCard === undefined) throw new Error('Missing editable stop card.');
    const required = within(secondCard).getByLabelText('Required stop');
    const locked = within(secondCard).getByLabelText('Lock this position');
    if (!(required instanceof HTMLInputElement) || !(locked instanceof HTMLInputElement)) {
      throw new TypeError('Stop state controls were not checkboxes.');
    }
    expect(required.checked).toBe(true);
    await user.click(required);
    expect(required.checked).toBe(false);

    await user.click(locked);
    expect(locked.checked).toBe(true);
    expect(
      within(secondCard)
        .getByRole('button', { name: /remove stop 2/iu })
        .hasAttribute('disabled'),
    ).toBe(true);

    await user.click(locked);
    await user.click(
      within(secondCard).getByRole('button', { name: /remove stop 2/iu }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('shows the complete appointment and service-duration controls on demand', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^add stop$/iu }));

    const card = screen.getAllByRole('article')[1];
    if (card === undefined) throw new Error('Missing intermediate stop card.');

    await user.selectOptions(
      within(card).getByLabelText('Appointment'),
      'open-window',
    );
    expect(within(card).getByLabelText('Window opens')).toBeDefined();
    expect(within(card).getByLabelText('Window closes')).toBeDefined();
    expect(within(card).getByLabelText('Late tolerance')).toBeDefined();

    await user.selectOptions(
      within(card).getByLabelText('Service duration source'),
      'range',
    );
    expect(within(card).getByLabelText('Minimum service')).toBeDefined();
    expect(within(card).getByLabelText('Expected service')).toBeDefined();
    expect(within(card).getByLabelText('Maximum service')).toBeDefined();

    await user.selectOptions(
      within(card).getByLabelText('Service duration source'),
      'historical-average',
    );
    expect(within(card).getByLabelText('Historical source')).toBeDefined();
    expect(within(card).getByLabelText('Historical sample size')).toBeDefined();
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
