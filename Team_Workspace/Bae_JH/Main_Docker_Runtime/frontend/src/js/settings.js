/**
 * settings.js
 */

import { renderTemplate } from './utils.js';
import { BackendHooks } from './api.js';

export function renderSettingsPage(container) {
  container.innerHTML = renderTemplate('settings');

  const slider = container.querySelector('#transparencySlider');
  if (slider) {
    const computedStyle = getComputedStyle(document.documentElement);
    const currentOpacity = computedStyle.getPropertyValue('--app-glass-opacity').trim() || '0.2';
    const savedOpacity = Math.round(parseFloat(currentOpacity) * 100);
    
    slider.value = savedOpacity;

    slider.addEventListener('input', async (e) => {
      const val = e.target.value;
      document.documentElement.style.setProperty('--app-glass-opacity', val / 100);
      await BackendHooks.saveUserSetting('appGlassOpacity', val);
    });
  }
}
