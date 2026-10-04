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
