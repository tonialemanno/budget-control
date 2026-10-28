// One tax claim, one remaining-balance snapshot and a reproducible monthly payment schedule.
// Monetary values are converted to cents to avoid floating-point residue.
function cents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Ungültiger Steuerbetrag.');
  return Math.round(amount * 100);
}

function isoDay(value) {
  const date = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Ungültiges Fälligkeitsdatum.');
  const parsed = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Ungültiges Fälligkeitsdatum.');
  return date;
}

function monthDue(first, monthIndex) {
  const [year, month, day] = isoDay(first).split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1 + monthIndex, 1, 12));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 12)).getUTCDate();
  const result = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min(day, lastDay), 12));
  return result.toISOString().slice(0, 10);
}

export function taxInstallmentSchedule(plan, payments = [], today = new Date()) {
  if (!plan) return { rows: [], remaining: 0, unallocated: 0, applied: 0 };
  const original = cents(plan.starting_balance);
  const rate = cents(plan.installment_amount);
  if (original <= 0 || rate <= 0) throw new Error('Offener Betrag und Rate müssen grösser als null sein.');
  const first = isoDay(plan.first_due_date);
  const snapshot = isoDay(plan.balance_as_of);
  if (first < snapshot) throw new Error('Die erste Rate darf nicht vor dem Saldo-Stichtag liegen.');
  const count = Math.ceil(original / rate);
  if (count > 240) throw new Error('Maximal 240 Monatsraten sind zulässig.');
  const actual = (payments || []).filter((entry) =>
    entry.obligation_id === plan.obligation_id &&
    String(entry.paid_at || '').slice(0, 10) >= snapshot &&
    ['payment', 'interest_payment'].includes(entry.payment_type)
  );
  const grouped = new Map();
  let applied = 0;
  let unallocated = 0;
  for (const payment of actual) {
    const amount = Math.max(0, cents(payment.amount));
    applied += amount;
    const due = String(payment.installment_due_date || '').slice(0, 10);
    if (!due) unallocated += amount;
    else grouped.set(due, (grouped.get(due) || 0) + amount);
  }
  let scheduled = original;
  const current = today instanceof Date ? today.toISOString().slice(0, 10) : isoDay(today);
  const rows = [];
  for (let index = 0; index < count; index++) {
    const dueDate = monthDue(first, index);
    const planned = Math.min(rate, scheduled);
    const paid = grouped.get(dueDate) || 0;
    rows.push({
      dueDate,
      planned: planned / 100,
      paid: paid / 100,
      open: Math.max(0, planned - paid) / 100,
      status: paid >= planned ? 'paid' : dueDate < current ? 'overdue' : paid > 0 ? 'partial' : 'open',
    });
    scheduled -= planned;
  }
  return { rows, remaining: Math.max(0, original - applied) / 100, unallocated: unallocated / 100, applied: applied / 100 };
}
