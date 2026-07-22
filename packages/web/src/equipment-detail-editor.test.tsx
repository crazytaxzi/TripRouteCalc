// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { EquipmentDetailEditor } from './equipment-detail-editor.js';
import { defaultTripDraft } from './model.js';
import type { TripDraft } from './types.js';

function Harness(): ReactNode {
  const [draft, setDraft] = useState<TripDraft>(defaultTripDraft);
  return (
    <>
      <EquipmentDetailEditor
        tractor={draft.tractor}
        trailer={draft.trailer}
        load={draft.load}
        onTractorChange={(tractor) => setDraft({ ...draft, tractor })}
        onTrailerChange={(trailer) => setDraft({ ...draft, trailer })}
        onLoadChange={(load) => setDraft({ ...draft, load })}
      />
      <output data-testid="equipment-state">{JSON.stringify(draft)}</output>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('Stage 18 advanced equipment detail editor', () => {
  it('edits tractor evidence, rail mappings, permits, temperature, and parking', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByText(/advanced equipment, permit, and cargo evidence/iu),
    );
    await user.type(screen.getByLabelText('VIN'), '1M8GDM9AXKP042788');
    const wheelbase = screen.getByLabelText('Wheelbase');
    await user.clear(wheelbase);
    await user.type(wheelbase, '20.5');
    await user.selectOptions(
      screen.getByLabelText('California compliance status'),
      'carrier-asserted-compliant',
    );
    await user.type(
      screen.getByLabelText('Compliance evidence source'),
      'Carrier compliance file',
    );
    await user.type(
      screen.getByLabelText('Compliance verified UTC timestamp'),
      '2026-07-21T18:00:00Z',
    );
    await user.type(
      screen.getByLabelText('Compliance explanation'),
      'Carrier record reviewed.',
    );

    await user.click(
      screen.getByRole('button', { name: /add rail mapping/iu }),
    );
    await user.type(screen.getByLabelText('Rail position'), '12');
    const kpra = screen.getByLabelText('Mapped KPRA');
    await user.clear(kpra);
    await user.type(kpra, '40.5');
    await user.type(
      screen.getByLabelText('Verification source'),
      'Trailer rail placard',
    );
    await user.type(
      screen.getByLabelText('Verified UTC timestamp'),
      '2026-07-21T18:05:00Z',
    );
    await user.click(screen.getByLabelText('Liftgate installed'));
    await user.type(
      screen.getByLabelText('Special equipment'),
      'pallet jack, load bars',
    );

    await user.click(screen.getByRole('button', { name: /add permit/iu }));
    await user.type(
      screen.getByLabelText('Permit identifier'),
      'PERMIT-CO-1',
    );
    await user.type(screen.getByLabelText('Jurisdiction code'), 'US-CO');
    await user.type(
      screen.getByLabelText('Permit restrictions'),
      'daylight travel only, no tunnel',
    );
    await user.click(
      screen.getByLabelText('Reefer temperature control required'),
    );
    await user.type(screen.getByLabelText('Minimum temperature'), '35');
    await user.type(screen.getByLabelText('Maximum temperature'), '45');
    await user.type(screen.getByLabelText('Temperature set point'), '40');
    await user.selectOptions(
      screen.getByLabelText('Secure parking requirement'),
      'high-value-and-secure-parking',
    );

    const output = screen.getByTestId('equipment-state');
    const draft = JSON.parse(output.textContent ?? '{}') as TripDraft;
    expect(draft.tractor).toMatchObject({
      vin: '1M8GDM9AXKP042788',
      wheelbaseFeet: 20.5,
      californiaComplianceStatus: 'carrier-asserted-compliant',
      californiaComplianceSourceName: 'Carrier compliance file',
      californiaComplianceVerifiedAt: '2026-07-21T18:00:00Z',
      californiaComplianceExplanation: 'Carrier record reviewed.',
    });
    expect(draft.trailer).toMatchObject({
      liftgate: true,
      specialEquipment: ['pallet jack', 'load bars'],
    });
    expect(draft.trailer.railPositionMappings?.[0]).toMatchObject({
      railPosition: '12',
      kpraFeet: 40.5,
      verificationSource: 'Trailer rail placard',
      verifiedAt: '2026-07-21T18:05:00Z',
    });
    expect(draft.load).toMatchObject({
      temperatureReeferRequired: true,
      temperatureMinimumFahrenheit: 35,
      temperatureMaximumFahrenheit: 45,
      temperatureSetPointFahrenheit: 40,
      secureParkingRequirement: 'high-value-and-secure-parking',
      permitIdentifiers: ['PERMIT-CO-1'],
    });
    expect(draft.load.permits?.[0]).toMatchObject({
      identifier: 'PERMIT-CO-1',
      jurisdictionCode: 'US-CO',
      restrictions: ['daylight travel only', 'no tunnel'],
    });
  });
});
