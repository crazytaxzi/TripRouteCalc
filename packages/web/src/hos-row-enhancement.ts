import { requiredPriorDutyDayCount } from './hos-requirements.js';
import { renderHosRepeatingRows } from './hos-row-editor.js';
import type { HosRepeatingRows } from './hos-row-editor.js';
import type { CycleType, DriverHosInputs } from './model.js';

type HosRowKind = 'prior-duty' | 'cycle-recap' | 'sleeper-period';

type ParsedRows = Pick<
  DriverHosInputs,
  'priorDutyTotals' | 'cycleRecaps' | 'existingSleeperPeriods'
>;

function lines(value: string): readonly string[] {
  return value
    .split(/\r?\n/u)
    .map((line): string => line.trim())
    .filter((line): boolean => line !== '');
}

function cycleType(value: string | undefined): CycleType {
  return value === '60_in_7' || value === '70_in_8' ? value : '';
}

function isHosRowKind(value: string | undefined): value is HosRowKind {
  return (
    value === 'prior-duty' ||
    value === 'cycle-recap' ||
    value === 'sleeper-period'
  );
}

export function parseHosRowText(
  priorDutyText: string,
  recapText: string,
  sleeperText: string,
): ParsedRows {
  return {
    priorDutyTotals: lines(priorDutyText).map((line) => {
      const [date = '', minutes = ''] = line.split(',');
      return { date: date.trim(), onDutyMinutes: Number(minutes.trim()) };
    }),
    cycleRecaps: lines(recapText).map((line) => {
      const [availableAt = '', minutes = ''] = line.split(',');
      return {
        availableAt: availableAt.trim(),
        minutesReturning: Number(minutes.trim()),
      };
    }),
    existingSleeperPeriods: lines(sleeperText).map((line) => {
      const [startAt = '', endAt = ''] = line.split(',');
      return { startAt: startAt.trim(), endAt: endAt.trim() };
    }),
  };
}

export function serializeHosRowText(rows: ParsedRows): Readonly<{
  priorDutyText: string;
  recapText: string;
  sleeperText: string;
}> {
  return {
    priorDutyText: rows.priorDutyTotals
      .map((entry): string => `${entry.date},${String(entry.onDutyMinutes)}`)
      .join('\n'),
    recapText: rows.cycleRecaps
      .map(
        (entry): string =>
          `${entry.availableAt},${String(entry.minutesReturning)}`,
      )
      .join('\n'),
    sleeperText: rows.existingSleeperPeriods
      .map((entry): string => `${entry.startAt},${entry.endAt}`)
      .join('\n'),
  };
}

export function addHosRow(
  rows: ParsedRows,
  kind: HosRowKind,
  selectedCycle: CycleType,
): ParsedRows {
  if (kind === 'prior-duty') {
    const maximum = requiredPriorDutyDayCount(selectedCycle);
    if (maximum === 0 || rows.priorDutyTotals.length >= maximum) return rows;
    return {
      ...rows,
      priorDutyTotals: [
        ...rows.priorDutyTotals,
        { date: '', onDutyMinutes: 0 },
      ],
    };
  }
  if (kind === 'cycle-recap') {
    return {
      ...rows,
      cycleRecaps: [
        ...rows.cycleRecaps,
        { availableAt: '', minutesReturning: 0 },
      ],
    };
  }
  return {
    ...rows,
    existingSleeperPeriods: [
      ...rows.existingSleeperPeriods,
      { startAt: '', endAt: '' },
    ],
  };
}

export function removeHosRow(
  rows: ParsedRows,
  kind: HosRowKind,
  index: number,
): ParsedRows {
  if (!Number.isInteger(index) || index < 0) return rows;
  if (kind === 'prior-duty') {
    if (index >= rows.priorDutyTotals.length) return rows;
    return {
      ...rows,
      priorDutyTotals: rows.priorDutyTotals.filter(
        (_entry, entryIndex): boolean => entryIndex !== index,
      ),
    };
  }
  if (kind === 'cycle-recap') {
    if (index >= rows.cycleRecaps.length) return rows;
    return {
      ...rows,
      cycleRecaps: rows.cycleRecaps.filter(
        (_entry, entryIndex): boolean => entryIndex !== index,
      ),
    };
  }
  if (index >= rows.existingSleeperPeriods.length) return rows;
  return {
    ...rows,
    existingSleeperPeriods: rows.existingSleeperPeriods.filter(
      (_entry, entryIndex): boolean => entryIndex !== index,
    ),
  };
}

function inputValue(row: Element, field: string): string {
  return (
    row.querySelector<HTMLInputElement>(`[data-hos-row-field="${field}"]`)
      ?.value ?? ''
  );
}

function rowsFromEditor(host: HTMLElement): ParsedRows {
  return {
    priorDutyTotals: [
      ...host.querySelectorAll('[data-hos-row-kind="prior-duty"]'),
    ]
      .filter((row): boolean => row.hasAttribute('data-hos-row-index'))
      .map((row) => ({
        date: inputValue(row, 'date'),
        onDutyMinutes: Number(inputValue(row, 'onDutyMinutes')),
      })),
    cycleRecaps: [
      ...host.querySelectorAll('[data-hos-row-kind="cycle-recap"]'),
    ]
      .filter((row): boolean => row.hasAttribute('data-hos-row-index'))
      .map((row) => ({
        availableAt: inputValue(row, 'availableAt'),
        minutesReturning: Number(inputValue(row, 'minutesReturning')),
      })),
    existingSleeperPeriods: [
      ...host.querySelectorAll('[data-hos-row-kind="sleeper-period"]'),
    ]
      .filter((row): boolean => row.hasAttribute('data-hos-row-index'))
      .map((row) => ({
        startAt: inputValue(row, 'startAt'),
        endAt: inputValue(row, 'endAt'),
      })),
  };
}

function dispatchSerializedRows(
  root: HTMLElement,
  serialized: ReturnType<typeof serializeHosRowText>,
): void {
  const pending: (readonly [string, string])[] = [
    ['hos.priorDutyTotals', serialized.priorDutyText],
    ['hos.cycleRecaps', serialized.recapText],
    ['hos.existingSleeperPeriods', serialized.sleeperText],
  ];
  const dispatchNext = (): void => {
    const next = pending.shift();
    if (next === undefined) return;
    const [name, value] = next;
    const textarea = root.querySelector<HTMLTextAreaElement>(
      `textarea[name="${name}"]`,
    );
    if (textarea === null) return;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    queueMicrotask(dispatchNext);
  };
  dispatchNext();
}

function enhance(root: HTMLElement): void {
  if (root.querySelector('[data-hos-repeating-enhanced]') !== null) return;
  const priorDuty = root.querySelector<HTMLTextAreaElement>(
    'textarea[name="hos.priorDutyTotals"]',
  );
  const recaps = root.querySelector<HTMLTextAreaElement>(
    'textarea[name="hos.cycleRecaps"]',
  );
  const sleepers = root.querySelector<HTMLTextAreaElement>(
    'textarea[name="hos.existingSleeperPeriods"]',
  );
  if (priorDuty === null || recaps === null || sleepers === null) return;

  const selectedCycle = cycleType(
    root.querySelector<HTMLSelectElement>('select[name="hos.cycleType"]')?.value,
  );
  const rows = parseHosRowText(priorDuty.value, recaps.value, sleepers.value);
  const hos: HosRepeatingRows = {
    cycleType: selectedCycle,
    priorDutyTotals: rows.priorDutyTotals,
    cycleRecaps: rows.cycleRecaps,
    existingSleeperPeriods: rows.existingSleeperPeriods,
  };
  const host = document.createElement('div');
  host.dataset.hosRepeatingEnhanced = 'true';
  host.innerHTML = renderHosRepeatingRows(hos);

  priorDuty.closest('label')?.setAttribute('hidden', '');
  recaps.closest('label')?.setAttribute('hidden', '');
  sleepers.closest('label')?.setAttribute('hidden', '');
  priorDuty.closest('.grid')?.after(host);

  const commit = (next: ParsedRows): void => {
    dispatchSerializedRows(root, serializeHosRowText(next));
  };

  host.addEventListener('input', (): void => {
    commit(rowsFromEditor(host));
  });
  host.addEventListener('click', (event): void => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const action = target.dataset.hosRowAction;
    const kind = target.dataset.hosRowKind;
    if (!isHosRowKind(kind)) return;
    const current = rowsFromEditor(host);
    if (action === 'add') {
      commit(addHosRow(current, kind, selectedCycle));
    } else if (action === 'remove') {
      commit(removeHosRow(current, kind, Number(target.dataset.hosRowIndex)));
    }
  });
}

export function installHosRowEnhancement(root: HTMLElement): MutationObserver {
  const observer = new MutationObserver((): void => {
    queueMicrotask((): void => {
      enhance(root);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  enhance(root);
  return observer;
}
