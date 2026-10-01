import assert from 'node:assert/strict';
import { effectiveNextDate, occurrenceCount, occurrenceNear } from '../assets/js/app/recurrence.js';

const monthly={next_date:'2026-01-31',cadence:'monthly',end_date:null};
assert.equal(effectiveNextDate(monthly,new Date('2026-02-01T12:00:00'))?.toISOString().slice(0,10),'2026-02-28');
assert.equal(effectiveNextDate(monthly,new Date('2026-10-01T12:00:00'))?.toISOString().slice(0,10),'2026-10-28');
assert.equal(occurrenceNear({next_date:'2026-09-25',cadence:'monthly'},'2026-10-25',3),true);
assert.equal(occurrenceNear({next_date:'2026-09-25',cadence:'monthly'},'2026-10-10',3),false);
assert.equal(occurrenceCount({next_date:'2026-10-05',cadence:'monthly'},new Date('2026-10-01'),new Date('2027-01-31')),4);

const ended={next_date:'2026-09-15',cadence:'monthly',end_date:'2026-09-30'};
assert.equal(effectiveNextDate(ended,new Date('2026-10-01T12:00:00')),null);

console.log('Recurring schedule assertions OK');
