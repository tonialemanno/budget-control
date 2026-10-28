export function normalizedProfilePreferences(profile) {
  const value = profile?.preferences;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function primaryAccountPreferenceId(profile, householdId, accounts = []) {
  if (!householdId) return '';
  const preferences = normalizedProfilePreferences(profile);
  const mapping = preferences.primary_account_by_household;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return '';
  const accountId = typeof mapping[householdId] === 'string' ? mapping[householdId] : '';
  if (!accountId) return '';
  if (accounts.length && !accounts.some((account)=>account.account_id === accountId && !account.is_archived)) return '';
  return accountId;
}

export function withPrimaryAccountPreference(preferences, householdId, accountId) {
  const base = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  const current = base.primary_account_by_household;
  const mapping = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  return {
    ...base,
    primary_account_by_household: {
      ...mapping,
      [householdId]: accountId,
    },
  };
}

export function financeMonthMode(profile) {
  const preferences = normalizedProfilePreferences(profile);
  return preferences.finance_month_mode === 'calendar' ? 'calendar' : 'day_25';
}

export function financeMonthModeLabel(mode) {
  return mode === 'calendar' ? 'Kalendermonat · 1.–letzter Tag' : 'Finanzmonat · 25.–24.';
}

export function withFinanceMonthPreference(preferences, mode) {
  const base = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? preferences : {};
  return {
    ...base,
    finance_month_mode: mode === 'calendar' ? 'calendar' : 'day_25',
  };
}

/**
 * An import destination is remembered separately for each household.
 * The most recent completed import is also durable, even for older profiles
 * that have not yet explicitly saved this preference.
 */
export function preferredImportAccountId(profile, householdId, accounts = [], importBatches = []) {
  const candidates=(accounts||[]).filter((account)=>!account.is_archived&&account.account_id);
  if(!candidates.length) return '';
  const eligible=(id)=>candidates.find((account)=>account.account_id===id);
  const saved=normalizedProfilePreferences(profile)?.import_account_by_household?.[householdId];
  if(saved&&eligible(saved)) return saved;
  const latest=[...(importBatches||[])]
    .filter((batch)=>batch.status==='completed'&&eligible(batch.account_id))
    .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0];
  if(latest) return latest.account_id;
  const main=primaryAccountPreferenceId(profile,householdId,candidates);
  if(main&&eligible(main)) return main;
  return (candidates.find((account)=>account.account_type==='checking'&&account.currency==='CHF')
    ||candidates.find((account)=>account.account_type==='checking')
    ||candidates.find((account)=>account.account_type!=='cash')
    ||candidates[0]).account_id;
}

export function withImportAccountPreference(preferences, householdId, accountId) {
  const base=preferences&&typeof preferences==='object'&&!Array.isArray(preferences)?preferences:{};
  const current=base.import_account_by_household;
  const mapping=current&&typeof current==='object'&&!Array.isArray(current)?current:{};
  return {...base,import_account_by_household:{...mapping,[householdId]:accountId}};
}
