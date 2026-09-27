from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ctx=(ROOT/'src/core/app-context.js').read_text()
wiz=(ROOT/'src/components/onboarding-wizard.js').read_text()
app=(ROOT/'src/js/app.js').read_text()
sw=(ROOT/'sw.js').read_text()
assert "profileReady:false" in ctx
assert "hasLoadedProfile" in ctx
assert "Object.prototype.hasOwnProperty.call(payload.profile,'onboarding_version')" in ctx
assert "ctx.profileReady===true" in wiz
assert "closeIfCompleted" in wiz
assert "shouldShow(lastCtx)" in wiz
assert "const APP_VERSION='69.0.0-beta.6';" in app
assert "aione-v69-0-0-beta-6" in sw
print('PASS: onboarding waits for persisted profile before opening')
