from pathlib import Path
import re,sys
R=Path(__file__).resolve().parents[1]
a=(R/'src/js/app.js').read_text();h=(R/'index.html').read_text();s=(R/'sw.js').read_text();v=(R/'VERSION').read_text().strip()
checks=[v=='69.0.0-beta.11',"const APP_VERSION='69.0.0-beta.11';" in a,'aione-v69-0-0-beta-11' in s,'/rest/v1/rpc/my_effective_features' in a,'/rest/v1/rpc/my_subscription_context' in a,'/rest/v1/rpc/admin_update_user_subscription' in a,'/rest/v1/rpc/admin_extend_trial' in a,'if(existing&&existing.id)' in a,'data-plan-user' not in a,len(re.findall(r'\\bid=\"([^\"]+)\"',h))==len(set(re.findall(r'\\bid=\"([^\"]+)\"',h)))]
if not all(checks): print('FAIL');sys.exit(1)
print('PASS: Beta 11 lifecycle/tax guards')
