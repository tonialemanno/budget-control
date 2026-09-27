from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
checks={
 'SG 2026 premium limits':"premiumSingle:3400,premiumJoint:6800,premiumChild:1100,noPensionSingle:500,noPensionJoint:1100,medicalThreshold:.02" in app,
 'TG premium limits':"premiumSingle:3500,premiumJoint:7000,premiumChild:1000,noPensionSingle:0,noPensionJoint:0,medicalThreshold:.05" in app,
 'unsupported cantons guarded':"supported:false,country,region,source:'Für diesen Kanton ist noch keine geprüfte Referenzlogik hinterlegt'" in app,
 'no year-only medical shortcut':"const medicalThreshold=y===2026?0.02:0.05" not in app,
 'rule source visible':"c.rules.source" in app,
}
for k,v in checks.items(): print(('PASS' if v else 'FAIL'),k)
if not all(checks.values()): sys.exit(1)
print('PASS: SG/TG tax reference logic is region-aware')
