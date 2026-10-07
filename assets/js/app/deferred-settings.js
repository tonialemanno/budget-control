import { t } from './i18n.js';

export function deferredSettingsForm(target) {
  if (!target) return null;
  if (target.matches?.('form[data-deferred-settings]')) return target;
  return target.closest?.('form[data-deferred-settings]') || null;
}

export function markDeferredSettingsDirty(target) {
  const form=deferredSettingsForm(target);
  if(!form) return false;
  form.dataset.dirty='true';
  form.classList.add('settings-form--dirty');
  for(const button of form.querySelectorAll('[data-deferred-save]')) button.disabled=false;
  for(const status of form.querySelectorAll('[data-deferred-status]')) status.textContent=t('Änderungen noch nicht gespeichert');
  return true;
}

export function markDeferredSettingsSaved(form) {
  const target=deferredSettingsForm(form);
  if(!target) return false;
  target.dataset.dirty='false';
  target.classList.remove('settings-form--dirty');
  for(const button of target.querySelectorAll('[data-deferred-save]')) button.disabled=true;
  for(const status of target.querySelectorAll('[data-deferred-status]')) status.textContent=t('Keine offenen Änderungen');
  return true;
}

export function hasDeferredSettingsChanges(root=document) {
  return Boolean(root?.querySelector?.('form[data-deferred-settings][data-dirty="true"]'));
}
