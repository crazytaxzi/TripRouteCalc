import { readFile, writeFile } from 'node:fs/promises';

const path = 'packages/web/src/App.tsx';
const current = await readFile(path, 'utf8');

const importAnchor = `import { HosEvidenceEditor } from './hos-evidence-editor.js';
import {
  clearDraft,
  defaultTripDraft,
  draftReducer,
  loadDraft,
  saveDraft,
  validateDraft,
} from './model.js';`;
const importReplacement = `import { EquipmentDetailEditor } from './equipment-detail-editor.js';
import { HosEvidenceEditor } from './hos-evidence-editor.js';
import {
  clearDraft,
  defaultTripDraft,
  draftReducer,
} from './model.js';
import {
  loadDraft,
  saveDraft,
  validateDraft,
} from './trip-form-model.js';`;

const sectionAnchor = `        </Section>

        <Section
          id="step-4"`;
const sectionReplacement = `        </Section>

        <EquipmentDetailEditor
          tractor={draft.tractor}
          trailer={draft.trailer}
          load={draft.load}
          onTractorChange={(tractor) =>
            update({ type: 'tractor', value: tractor })
          }
          onTrailerChange={(trailer) =>
            update({ type: 'trailer', value: trailer })
          }
          onLoadChange={(load) => update({ type: 'load', value: load })}
        />

        <Section
          id="step-4"`;

if (!current.includes(importAnchor)) {
  throw new Error('App import anchor did not match the reviewed Stage 18 file.');
}
if (!current.includes(sectionAnchor)) {
  throw new Error('App Step 4 anchor did not match the reviewed Stage 18 file.');
}
if (current.includes("./equipment-detail-editor.js")) {
  throw new Error('Advanced equipment editor is already integrated.');
}

const next = current
  .replace(importAnchor, importReplacement)
  .replace(sectionAnchor, sectionReplacement);

await writeFile(path, next, 'utf8');
console.log(`Integrated advanced Stage 18 equipment UI into ${path}.`);
