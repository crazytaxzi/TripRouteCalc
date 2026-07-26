import { TripSetupApp } from './app.js';
import { installHosRowEnhancement } from './hos-row-enhancement.js';
import { installStage18ValidationEnhancement } from './validation-enhancement.js';

const root = document.querySelector<HTMLElement>('[data-trip-setup-app]');
if (root !== null) {
  new TripSetupApp(root);
  installHosRowEnhancement(root);
  installStage18ValidationEnhancement(root);
}
