import type { CycleType } from './model.js';
import { priorDutyCountMessage } from './hos-requirements.js';

const LEGACY_MESSAGES = [
  'Enter 6 prior daily on-duty totals for the selected cycle.',
  'Enter 7 prior daily on-duty totals for the selected cycle.',
] as const;

function selectedCycle(root: HTMLElement): CycleType {
  const value = root.querySelector<HTMLSelectElement>(
    'select[name="hos.cycleType"]',
  )?.value;
  return value === '60_in_7' || value === '70_in_8' ? value : '';
}

function priorDutyCount(root: HTMLElement): number {
  const enhancedRows = root.querySelectorAll(
    '[data-hos-repeating-enhanced] [data-hos-row-kind="prior-duty"][data-hos-row-index]',
  );
  if (enhancedRows.length > 0) return enhancedRows.length;
  const text =
    root.querySelector<HTMLTextAreaElement>(
      'textarea[name="hos.priorDutyTotals"]',
    )?.value ?? '';
  return text
    .split(/\r?\n/u)
    .map((line): string => line.trim())
    .filter((line): boolean => line !== '').length;
}

function issuesList(root: HTMLElement): HTMLUListElement | undefined {
  const existing = root.querySelector<HTMLUListElement>('.issues ul');
  if (existing !== null) return existing;
  const form = root.querySelector('form');
  if (form === null) return undefined;
  const section = document.createElement('section');
  section.className = 'issues';
  section.setAttribute('aria-labelledby', 'issues-heading');
  section.innerHTML =
    '<h2 id="issues-heading">Before calculation</h2><ul></ul>';
  form.before(section);
  return section.querySelector('ul') ?? undefined;
}

export function synchronizePriorDutyValidation(root: HTMLElement): void {
  root.querySelectorAll<HTMLLIElement>('.issues li').forEach((item): void => {
    if (LEGACY_MESSAGES.some((message) => item.innerText.includes(message))) {
      item.remove();
    }
  });

  const message = priorDutyCountMessage(
    selectedCycle(root),
    priorDutyCount(root),
  );
  const existing = root.querySelector<HTMLLIElement>(
    '[data-stage18-prior-duty-issue]',
  );
  if (message === undefined) {
    existing?.remove();
    const section = root.querySelector<HTMLElement>('.issues');
    if (section?.querySelector('li') === null) section.remove();
    return;
  }
  if (existing?.dataset.message === message) return;
  existing?.remove();
  const list = issuesList(root);
  if (list === undefined) return;
  const item = document.createElement('li');
  item.dataset.stage18PriorDutyIssue = 'true';
  item.dataset.message = message;
  const label = document.createElement('strong');
  label.textContent = 'Required:';
  item.append(label, ` ${message}`);
  list.append(item);
}

export function installStage18ValidationEnhancement(
  root: HTMLElement,
): MutationObserver {
  let queued = false;
  const schedule = (): void => {
    if (queued) return;
    queued = true;
    queueMicrotask((): void => {
      queued = false;
      synchronizePriorDutyValidation(root);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
  root.addEventListener('input', schedule);
  root.addEventListener('change', schedule);
  schedule();
  return observer;
}
