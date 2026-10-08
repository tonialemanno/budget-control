import assert from 'node:assert/strict';
import {
  calculateGoalTargetDate,
  goalPlanningMonths,
  goalStartsInFuture,
  resolveGoalSchedule,
} from '../assets/js/app/goal-planning.js';

assert.equal(calculateGoalTargetDate('2027-01-01',12),'2027-12-31');
assert.equal(calculateGoalTargetDate('2027-03-15',6),'2027-09-14');

const schedule=resolveGoalSchedule({
  startDate:'2027-01-01',
  durationMonths:'12',
  targetDate:'2030-01-01',
});
assert.deepEqual(schedule,{
  startDate:'2027-01-01',
  durationMonths:12,
  targetDate:'2027-12-31',
});

assert.equal(goalPlanningMonths({start_date:'2027-01-01',duration_months:12,target_date:'2027-12-31'},{now:new Date('2026-10-08T12:00:00Z')}),12);
assert.equal(goalStartsInFuture({start_date:'2027-01-01'},{now:new Date('2026-10-08T12:00:00Z')}),true);
assert.throws(()=>resolveGoalSchedule({durationMonths:12}),/Startdatum/);

console.log('goal planning assertions OK');
