// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './App.js';
import { DRAFT_STORAGE_KEY } from './model.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Stage 18 mounted advanced equipment editor', () => {
  it('autosaves detailed tractor evidence through the composed draft model', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByText('Advanced equipment, permit, and cargo evidence'),
    );
    const vin = screen.getByLabelText('VIN');
    await user.type(vin, '1M8GDM9AXKP042788');

    expect(screen.queryByLabelText('Permit identifiers')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add permit' })).toBeDefined();

    await waitFor(
      () => {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        expect(raw).not.toBeNull();
        const saved = JSON.parse(raw ?? '{}') as {
          readonly tractor?: { readonly vin?: string };
        };
        expect(saved.tractor?.vin).toBe('1M8GDM9AXKP042788');
      },
      { timeout: 2_000 },
    );
  });
});
