import { TripSetupApp } from './app.js';

const root = document.querySelector<HTMLElement>('[data-trip-setup-app]');
if (root !== null) new TripSetupApp(root);
