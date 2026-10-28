import assert from 'node:assert/strict';
import { taxInstallmentSchedule } from '../assets/js/app/tax-installments.js';

const plan = { obligation_id: 'tax-claim', starting_balance: 5444.95, installment_amount: 605, balance_as_of: '2026-10-28', first_due_date: '2026-11-25' };
const result = taxInstallmentSchedule(plan, [], '2026-10-28');
assert.equal(result.rows.length, 9);
assert.equal(result.rows[0].dueDate, '2026-11-25');
assert.equal(result.rows[0].planned, 605);
assert.equal(result.rows[8].dueDate, '2027-07-25');
assert.equal(result.rows[8].planned, 604.95);
assert.equal(result.remaining, 5444.95);
assert.equal(result.rows.reduce((sum, row) => sum + Math.round(row.planned * 100), 0), 544495);

const linked = taxInstallmentSchedule(plan, [{ obligation_id: 'tax-claim', amount: 605, paid_at: '2026-11-25', payment_type: 'payment', installment_due_date: '2026-11-25' }], '2026-11-26');
assert.equal(linked.rows[0].status, 'paid');
assert.equal(linked.remaining, 4839.95);

const unmatched = taxInstallmentSchedule(plan, [{ obligation_id: 'tax-claim', amount: 300, paid_at: '2026-11-25', payment_type: 'payment', installment_due_date: null }], '2026-11-26');
assert.equal(unmatched.remaining, 5144.95);
assert.equal(unmatched.unallocated, 300);
assert.equal(unmatched.rows[0].status, 'overdue');

const monthEnd = taxInstallmentSchedule({ ...plan, starting_balance: 300, installment_amount: 100, first_due_date: '2026-10-31', balance_as_of: '2026-10-01' }, [], '2026-10-01');
assert.deepEqual(monthEnd.rows.map((row) => row.dueDate), ['2026-10-31', '2026-11-30', '2026-12-31']);
assert.throws(() => taxInstallmentSchedule({ ...plan, installment_amount: 0 }), /Rate/);
assert.throws(() => taxInstallmentSchedule({ ...plan, first_due_date: '2026-02-30' }), /Fälligkeitsdatum/);
console.log('tax installment schedule: ok');
