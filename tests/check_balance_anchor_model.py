from pathlib import Path
import re, subprocess, json, sys
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
wiz=(ROOT/'src/components/onboarding-wizard.js').read_text(encoding='utf-8')
mig=(ROOT/'supabase/migrations/20260928_aione_v690_onboarding_balance_anchor_fix.sql').read_text(encoding='utf-8')
errors=[]
def ok(cond,msg):
    if not cond: errors.append(msg)

ok('current_balance:Number(draft.currentBalance||0)' in wiz,'wizard does not send current_balance')
ok('balance_anchor_date:anchorDate' in app and 'balance_anchor_amount:currentBalance' in app,'onboarding account does not persist balance anchor')
ok("opening_balance:currentBalance" in app,'onboarding compatibility opening balance missing')
ok('body.balance_anchor_date=localDateISO();body.balance_anchor_amount=body.opening_balance' in app,'normal account creation does not establish a current-balance anchor')
ok("notes = 'Ersteinrichtung aione'" in mig and 'balance_anchor_date is null' in mig and 'balance_anchor_amount is null' in mig,'repair migration is not narrowly scoped')
ok('transaction_entries' not in mig.lower() and 'delete ' not in mig.lower(),'repair migration must not modify/delete transactions')

m=re.search(r"function accountBalanceAsOf\(a,date\)\{[^\n]+\}",app)
ok(bool(m),'accountBalanceAsOf missing')
if m:
    src=m.group(0)
    harness=f"""
const transactions=[
  {{posting_status:'posted',booked_on:'2025-10-15',transaction_entries:[{{account_id:'a',amount:-850.00}}]}},
  {{posting_status:'posted',booked_on:'2026-01-25',transaction_entries:[{{account_id:'a',amount:5200.00}}]}},
  {{posting_status:'posted',booked_on:'2026-03-04',transaction_entries:[{{account_id:'a',amount:-129.90}}]}},
  {{posting_status:'posted',booked_on:'2026-06-30',transaction_entries:[{{account_id:'a',amount:-2400.00}}]}},
  {{posting_status:'posted',booked_on:'2026-09-27',transaction_entries:[{{account_id:'a',amount:-1552.14}}]}},
  {{posting_status:'posted',booked_on:'2026-09-28',transaction_entries:[{{account_id:'a',amount:-100.00}}]}},
  {{posting_status:'pending',booked_on:'2026-09-28',transaction_entries:[{{account_id:'a',amount:-999.00}}]}}
];
function localDateISO(){{return '2026-09-28'}}
{src}
const a={{id:'a',balance:12413.75,opening_balance:12413.75}};
const out={{
  today:accountBalanceAsOf(a,'2026-09-28'),
  beforeLastImport:accountBalanceAsOf(a,'2026-09-26'),
  yearStart:accountBalanceAsOf(a,'2026-01-01')
}};
console.log(JSON.stringify(out));
"""
    r=subprocess.run(['node','-e',harness],capture_output=True,text=True)
    ok(r.returncode==0,'accountBalanceAsOf harness failed: '+r.stderr.strip())
    if r.returncode==0:
        out=json.loads(r.stdout)
        ok(abs(out['today']-12413.75)<0.001,'current anchored balance changed by 12-month historical import')
        ok(abs(out['beforeLastImport']-14065.89)<0.001,'recent historical balance reconstruction from current anchor is wrong')
        ok(abs(out['yearStart']-11395.79)<0.001,'12-month backward reconstruction from current anchor is wrong')

if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: current-balance anchor model')
print('Historical imports stay in analytics without being applied a second time to the onboarding current balance.')
