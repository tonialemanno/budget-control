$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Temp = Join-Path $env:TEMP ('finance-beta52-' + [Guid]::NewGuid().ToString('N'))
$Download = Join-Path $Temp 'beta.zip'
$Extract = Join-Path $Temp 'extract'
$TargetName = 'finance-v2.3-beta5.2-receipt-camera'
$Target = Join-Path $Temp $TargetName
$Output = Join-Path $Root ($TargetName + '.zip')

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}

function Replace-Required([string]$Path, [string]$Old, [string]$New, [string]$Label) {
  $content = [System.IO.File]::ReadAllText($Path)
  if (-not $content.Contains($Old)) { throw "Patch '$Label' passt nicht zum aktuellen Beta-5.1-Stand: $Path" }
  $content = $content.Replace($Old, $New)
  Write-Utf8NoBom $Path $content
}

function Append-Required([string]$Path, [string]$Block, [string]$Marker, [string]$Label) {
  $content = [System.IO.File]::ReadAllText($Path)
  if ($content.Contains($Marker)) { return }
  Write-Utf8NoBom $Path ($content.TrimEnd() + "`r`n`r`n" + $Block.Trim() + "`r`n")
}

try {
  New-Item -ItemType Directory -Force -Path $Temp, $Extract | Out-Null
  Write-Host '1/5 Lade den aktuellen beta-Branch von GitHub ...'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://codeload.github.com/tonialemanno/budget-control/zip/refs/heads/beta' -OutFile $Download
  Expand-Archive -LiteralPath $Download -DestinationPath $Extract -Force
  $Source = Get-ChildItem -LiteralPath $Extract -Directory | Select-Object -First 1
  if (-not $Source) { throw 'GitHub-Archiv konnte nicht entpackt werden.' }
  Copy-Item -LiteralPath $Source.FullName -Destination $Target -Recurse

  $Config = Join-Path $Target 'assets/js/app/config.js'
  $Main = Join-Path $Target 'assets/js/main.js'
  $Transactions = Join-Path $Target 'assets/js/views/transactions.js'
  $CsvImport = Join-Path $Target 'assets/js/app/csv-import.js'
  $FinanceApi = Join-Path $Target 'assets/js/app/finance-api.js'
  $FormsCss = Join-Path $Target 'assets/css/forms.css'
  $ResponsiveCss = Join-Path $Target 'assets/css/responsive.css'
  $Headers = Join-Path $Target '_headers'
  $Readme = Join-Path $Target 'README.md'
  $Version = Join-Path $Target 'VERSION.md'

  $configText = [System.IO.File]::ReadAllText($Config)
  if (-not $configText.Contains("version: '2.3.0-beta-5.1'")) {
    throw 'Der beta-Branch ist nicht Beta 5.1. Bitte zuerst den von Noah erstellten Beta-5.1-Stand hochladen.'
  }

  Write-Host '2/5 Integriere Belegkamera, OCR, Dublettenprüfung und Dokumentverknüpfung ...'
  $receiptSource = Join-Path $Root 'payload/assets/js/app/receipt-ocr.js'
  $receiptDest = Join-Path $Target 'assets/js/app/receipt-ocr.js'
  Copy-Item -LiteralPath $receiptSource -Destination $receiptDest -Force

  $testSource = Join-Path $Root 'payload/tests/receipt-ocr-tests.mjs'
  $testsDir = Join-Path $Target 'tests'
  New-Item -ItemType Directory -Force -Path $testsDir | Out-Null
  Copy-Item -LiteralPath $testSource -Destination (Join-Path $testsDir 'receipt-ocr-tests.mjs') -Force

  Replace-Required $Config "version: '2.3.0-beta-5.1'" "version: '2.3.0-beta-5.2'" 'Version'

  $oldMerchant = "  { pattern:/media\s*markt|mediamarkt/i, name:'MediaMarkt', key:'mediamarkt', category:'Shopping' },"
  $newMerchant = @'
  { pattern:/mcdonald'?s|mc\s*donald/i, name:"McDonald's", key:'mcdonalds', category:'Restaurant' },
  { pattern:/media\s*markt|mediamarkt/i, name:'MediaMarkt', key:'mediamarkt', category:'Shopping' },
'@.Trim()
  Replace-Required $CsvImport $oldMerchant $newMerchant 'McDonalds-Händlererkennung'

  $oldApi = @'
  uploadDocument(householdId, file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const path = `${householdId}/${crypto.randomUUID()}-${safeName}`;
    return backend.storageUpload('finance-documents', path, file).then(() => path);
  },
  downloadDocument: (path) => backend.storageDownload('finance-documents', path),
'@
  $newApi = @'
  uploadDocument(householdId, file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const path = `${householdId}/${crypto.randomUUID()}-${safeName}`;
    return backend.storageUpload('finance-documents', path, file).then(() => path);
  },
  deleteStoredDocument: (path) => backend.storageDelete('finance-documents', [path]),
  downloadDocument: (path) => backend.storageDownload('finance-documents', path),
'@
  Replace-Required $FinanceApi $oldApi $newApi 'Storage-Cleanup'

  $oldOptions = @'
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
'@
  $newOptions = @'
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const receiptCategoryOptions = categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
'@
  Replace-Required $Transactions $oldOptions $newOptions 'Receipt-Kategorieoptionen'

  $oldActions = @'
actions:canWrite?`<button class="action-button action-button--secondary" type="button" data-action="categorization-open">${icon('sparkles')} Kategorien analysieren</button><button class="action-button action-button--primary" type="button" data-action="show-form" data-target="transaction-create">${icon('plus')} Transaktion</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transfer-create" ${accounts.length>1?'':'disabled'}>${icon('repeat')} Umbuchung</button>`:''
'@
  $newActions = @'
actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="receipt-camera">${icon('receipt')} Beleg fotografieren</button><button class="action-button action-button--secondary" type="button" data-action="categorization-open">${icon('sparkles')} Kategorien analysieren</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transaction-create">${icon('plus')} Transaktion</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transfer-create" ${accounts.length>1?'':'disabled'}>${icon('repeat')} Umbuchung</button>`:''
'@
  Replace-Required $Transactions $oldActions $newActions 'Belegkamera-Button'

  $transferForm = @'
    ${canWrite?formShell('transfer-create','Umbuchung','Geld zwischen eigenen Konten verschieben',transferFields,{hidden:true,submitLabel:'Umbuchung speichern'}):''}
'@
  $receiptForm = @'
    ${canWrite?formShell('transfer-create','Umbuchung','Geld zwischen eigenen Konten verschieben',transferFields,{hidden:true,submitLabel:'Umbuchung speichern'}):''}
    ${canWrite?`<input id="receiptCameraInput" type="file" accept="image/*" capture="environment" hidden>
    <form class="card card-padding form-card receipt-review" id="receipt-create" data-form="receipt-create" hidden>
      <div class="card-heading"><div><h3 class="card-title">Beleg prüfen</h3><p class="card-subtitle">Finance liest Händler, Datum und Betrag lokal auf diesem Gerät. Vor dem Buchen kannst du alles korrigieren.</p></div><span class="list-row-leading">${icon('receipt')}</span></div>
      <div class="receipt-review-grid">
        <div class="receipt-preview-card"><img id="receiptPreview" class="receipt-preview" alt="Belegvorschau"><div class="receipt-ocr-status"><strong id="receiptOcrStatus">Bereit</strong><span id="receiptOcrProgressText">Foto auswählen</span><div class="receipt-progress"><span id="receiptOcrProgressBar"></span></div></div></div>
        <div class="form-grid form-grid--2 receipt-fields">
          <label class="field form-grid-span"><span>Händler</span><input class="text-control" id="receiptMerchant" name="merchant" required placeholder="z. B. McDonald's"></label>
          <label class="field"><span>Betrag</span><input class="text-control" id="receiptAmount" name="amount" type="number" step="0.01" min="0.01" required></label>
          <label class="field"><span>Währung</span><select class="text-control" id="receiptCurrency" name="currency"><option value="CHF">CHF</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></select></label>
          <label class="field"><span>Belegdatum</span><input class="text-control" id="receiptDate" name="receiptDate" type="date" required></label>
          <label class="field"><span>Kategorie</span><select class="text-control" id="receiptCategory" name="categoryId"><option value="">Ohne Kategorie</option>${receiptCategoryOptions}</select></label>
          <label class="field form-grid-span"><span>Was soll Finance tun?</span><select class="text-control" id="receiptMode" name="mode"><option value="new">Neue Ausgabe buchen</option><option value="link">Mit vorhandener Bankbuchung verknüpfen</option></select></label>
          <label class="field form-grid-span" id="receiptAccountField"><span>Zahlungskonto</span><select class="text-control" id="receiptAccount" name="accountId"><option value="">Bitte wählen</option>${accountOptions}</select></label>
          <label class="field form-grid-span" id="receiptMatchField" hidden><span>Passende Bankbuchung</span><select class="text-control" id="receiptMatch" name="transactionId"><option value="">Bitte wählen</option></select><small id="receiptMatchHint">Finance sucht nach Betrag, Währung, Datum und Händler.</small></label>
          <div class="inline-alert receipt-match-alert form-grid-span" id="receiptMatchAlert" hidden></div>
          <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" id="receiptNote" name="note" rows="2" placeholder="optional"></textarea></label>
          <details class="receipt-ocr-details form-grid-span"><summary>Erkannten OCR-Text anzeigen</summary><pre id="receiptOcrText" class="receipt-ocr-text"></pre></details>
        </div>
      </div>
      <div class="form-actions"><button class="action-button action-button--secondary" type="button" data-action="receipt-cancel">Abbrechen</button><button class="action-button action-button--primary" type="submit">Beleg übernehmen</button></div>
    </form>`:''}
'@
  Replace-Required $Transactions $transferForm $receiptForm 'Beleg-Prüfformular'

  $oldImport = "import { parseImportFile } from './app/import-file.js';"
  $newImport = "import { parseImportFile } from './app/import-file.js';`nimport { analyzeReceiptImage, findReceiptMatches } from './app/receipt-ocr.js';"
  Replace-Required $Main $oldImport $newImport 'OCR-Import'

  $oldState = 'const importState = { file: null, parsed: null };'
  $newState = @'
const importState = { file: null, parsed: null };
const receiptState = { file: null, previewUrl: null, analysis: null, matches: [] };
'@.Trim()
  Replace-Required $Main $oldState $newState 'Receipt-State'

  $handleFormAnchor = 'async function handleForm(form) {'
  $receiptHelpers = @'
function resetReceiptState() {
  if (receiptState.previewUrl) URL.revokeObjectURL(receiptState.previewUrl);
  receiptState.file = null;
  receiptState.previewUrl = null;
  receiptState.analysis = null;
  receiptState.matches = [];
}

function setReceiptMode(mode) {
  const accountField = document.querySelector('#receiptAccountField');
  const matchField = document.querySelector('#receiptMatchField');
  if (accountField) accountField.hidden = mode === 'link';
  if (matchField) matchField.hidden = mode !== 'link';
}

function setReceiptProgress(status, progress = 0) {
  const title = document.querySelector('#receiptOcrStatus');
  const text = document.querySelector('#receiptOcrProgressText');
  const bar = document.querySelector('#receiptOcrProgressBar');
  const value = Math.max(0, Math.min(1, Number(progress) || 0));
  if (title) title.textContent = value >= 1 ? 'Analyse abgeschlossen' : 'Beleg wird analysiert';
  if (text) text.textContent = status || 'OCR läuft …';
  if (bar) bar.style.width = `${Math.round(value * 100)}%`;
}

function defaultReceiptAccount(currency) {
  return runtime.accounts.find((account)=>account.currency===currency && ['checking','credit','wallet','cash'].includes(account.account_type))
    || runtime.accounts.find((account)=>account.currency===currency && account.account_type!=='savings')
    || runtime.accounts.find((account)=>account.currency===currency)
    || null;
}

function populateReceiptForm(analysis) {
  const merchant = document.querySelector('#receiptMerchant');
  const amount = document.querySelector('#receiptAmount');
  const currency = document.querySelector('#receiptCurrency');
  const date = document.querySelector('#receiptDate');
  const category = document.querySelector('#receiptCategory');
  const account = document.querySelector('#receiptAccount');
  const mode = document.querySelector('#receiptMode');
  const match = document.querySelector('#receiptMatch');
  const alert = document.querySelector('#receiptMatchAlert');
  const raw = document.querySelector('#receiptOcrText');
  if (!merchant || !amount || !currency || !date || !category || !account || !mode || !match) return;

  merchant.value = analysis.merchant && analysis.merchant !== 'Unbekannter Händler' ? analysis.merchant : '';
  amount.value = analysis.amount ? Number(analysis.amount).toFixed(2) : '';
  currency.value = analysis.currency || runtime.household.base_currency || 'CHF';
  date.value = analysis.date || dateInputValue();
  const suggested = runtime.categories.find((row)=>row.kind==='expense' && row.name.toLowerCase()===String(analysis.suggestedCategoryName||'').toLowerCase());
  category.value = suggested?.id || '';
  const suggestedAccount = defaultReceiptAccount(currency.value);
  account.value = suggestedAccount?.account_id || '';
  if (raw) raw.textContent = analysis.rawText || '';

  receiptState.matches = findReceiptMatches({ transactions:runtime.transactions, amount:analysis.amount, currency:currency.value, date:date.value, merchant:merchant.value });
  match.innerHTML = '<option value="">Bitte wählen</option>' + receiptState.matches.map(({tx,score})=>`<option value="${tx.id}">${escapeHtml(dateInputValue(new Date(tx.occurred_at)))} · ${escapeHtml(tx.description)} · ${Math.abs(Number(tx.amount)).toFixed(2)} ${escapeHtml(tx.currency)} · Treffer ${Math.min(100,Math.round(score))}%</option>`).join('');
  const strong = receiptState.matches.find((entry)=>entry.highConfidence);
  if (strong) {
    mode.value = 'link';
    match.value = strong.tx.id;
    if (alert) { alert.hidden=false; alert.innerHTML='<strong>Passende Bankbuchung gefunden.</strong><span>Finance verknüpft den Beleg statt eine zweite Ausgabe anzulegen.</span>'; }
  } else {
    mode.value = 'new';
    if (alert) {
      alert.hidden = receiptState.matches.length===0;
      if (receiptState.matches.length) alert.innerHTML='<strong>Mögliche ähnliche Buchung gefunden.</strong><span>Bitte prüfen, ob der Beleg bereits über den Bankimport vorhanden ist.</span>';
    }
  }
  setReceiptMode(mode.value);
  const confidence = Math.round(Math.max(Number(analysis.confidence||0), Number(analysis.ocrConfidence||0)) * 100);
  setReceiptProgress(`OCR ${confidence}% · bitte Händler, Betrag und Datum kurz prüfen`, 1);
}

async function handleReceiptFile(file) {
  if (!(file instanceof File) || !file.size) return;
  if (!String(file.type||'').startsWith('image/')) throw new Error('Bitte ein Foto bzw. Bild des Belegs auswählen.');
  if (file.size > 10*1024*1024) throw new Error('Das Belegfoto ist grösser als 10 MB.');
  resetReceiptState();
  receiptState.file = file;
  receiptState.previewUrl = URL.createObjectURL(file);
  const form = document.querySelector('#receipt-create');
  const preview = document.querySelector('#receiptPreview');
  if (preview) preview.src = receiptState.previewUrl;
  form?.removeAttribute('hidden');
  form?.scrollIntoView({behavior:'smooth',block:'start'});
  setReceiptProgress('OCR wird vorbereitet …',0.02);

  try {
    const analysis = await analyzeReceiptImage(file,{ fallbackCurrency:runtime.household.base_currency||'CHF', onProgress:({status,progress})=>setReceiptProgress(status,progress) });
    receiptState.analysis = analysis;
    populateReceiptForm(analysis);
  } catch (error) {
    const fallback = { merchant:'', amount:null, currency:runtime.household.base_currency||'CHF', date:dateInputValue(), suggestedCategoryName:null, rawText:'', confidence:0, ocrConfidence:0 };
    receiptState.analysis = fallback;
    populateReceiptForm(fallback);
    const title=document.querySelector('#receiptOcrStatus'); const text=document.querySelector('#receiptOcrProgressText');
    if(title) title.textContent='OCR nicht verfügbar';
    if(text) text.textContent='Du kannst Händler, Betrag und Datum trotzdem manuell eingeben.';
    showToast(humanError(error),'error');
  }
}

'@
  Replace-Required $Main $handleFormAnchor ($receiptHelpers + $handleFormAnchor) 'Receipt-Helfer'

  $transactionAnchor = "  if (id === 'transaction-create') {"
  $receiptSubmit = @'
  if (id === 'receipt-create') {
    if (!(receiptState.file instanceof File) || !receiptState.file.size) throw new Error('Bitte zuerst einen Beleg fotografieren.');
    const merchantName=formValue(data,'merchant');
    const amount=Math.abs(numberValue(data,'amount'));
    const receiptDate=formValue(data,'receiptDate');
    const receiptCurrency=formValue(data,'currency')||currency;
    const categoryId=nullValue(data,'categoryId');
    const mode=formValue(data,'mode')||'new';
    if(!merchantName) throw new Error('Bitte den Händler prüfen oder ergänzen.');
    if(!(amount>0)) throw new Error('Bitte den erkannten Betrag prüfen.');
    if(!receiptDate) throw new Error('Bitte das Belegdatum prüfen.');
    const category=categoryId?runtime.categories.find((row)=>row.id===categoryId&&row.kind==='expense'):null;
    if(categoryId&&!category) throw new Error('Bitte eine gültige Ausgabenkategorie auswählen.');

    const merchantInfo=merchantFromTransaction({counterparty:merchantName,description:merchantName});
    const merchant=await financeApi.upsertMerchant({household_id:h,name:merchantName,normalized_key:merchantInfo.key,default_category_id:categoryId});
    let tx=null;
    let createdTx=false;
    let storagePath=null;
    try {
      if(mode==='link') {
        const transactionId=formValue(data,'transactionId');
        tx=runtime.transactions.find((row)=>row.id===transactionId);
        if(!tx||tx.status!=='booked'||Number(tx.amount)>=0||tx.transfer_group_id||tx.cashflow_type==='debt_payment') throw new Error('Bitte eine passende gebuchte Ausgangsbuchung auswählen.');
        if(tx.currency!==receiptCurrency||Math.abs(Math.abs(Number(tx.amount))-amount)>Math.max(0.02,amount*0.002)) throw new Error('Betrag und Währung passen nicht zur ausgewählten Bankbuchung.');
        const patch={};
        if(categoryId) patch.category_id=categoryId;
        if(merchant?.id) patch.merchant_id=merchant.id;
        if(!tx.counterparty) patch.counterparty=merchantName;
        if(Object.keys(patch).length) tx=await financeApi.updateTransaction(tx.id,patch) || tx;
      } else {
        const account=runtime.accounts.find((row)=>row.account_id===formValue(data,'accountId'));
        if(!account) throw new Error('Bitte ein Zahlungskonto auswählen.');
        if(account.currency!==receiptCurrency) throw new Error('Belegwährung und Zahlungskonto müssen für eine neue Ausgabe dieselbe Währung haben. Bei Fremdwährungs-Kartenzahlungen bitte die Bankbuchung verknüpfen.');
        const duplicates=findReceiptMatches({transactions:runtime.transactions,amount,currency:receiptCurrency,date:receiptDate,merchant:merchantName});
        if(duplicates.some((entry)=>entry.highConfidence) && !confirm('Finance hat eine sehr ähnliche Bankbuchung gefunden. Trotzdem eine neue Ausgabe anlegen?')) return;
        tx=await financeApi.createTransaction({household_id:h,account_id:account.account_id,category_id:categoryId,merchant_id:merchant?.id||null,occurred_at:new Date(`${receiptDate}T12:00:00`).toISOString(),amount:-amount,currency:receiptCurrency,description:merchantName,counterparty:merchantName,note:nullValue(data,'note')||'Belegfoto',status:'booked',source:'manual'});
        createdTx=true;
      }

      storagePath=await financeApi.uploadDocument(h,receiptState.file);
      await financeApi.createDocument({household_id:h,object_type:'transaction',object_id:tx.id,name:receiptState.file.name||`Beleg-${receiptDate}.jpg`,storage_path:storagePath,mime_type:receiptState.file.type||'image/jpeg',file_size:receiptState.file.size,document_date:receiptDate,notes:'Kassenbeleg · Fotoerfassung'});
    } catch(error) {
      if(createdTx&&tx?.id) await financeApi.deleteTransaction(tx.id).catch(()=>{});
      if(storagePath) await financeApi.deleteStoredDocument(storagePath).catch(()=>{});
      throw error;
    }
    resetReceiptState();
    await refresh(mode==='link'?'Beleg mit vorhandener Bankbuchung verknüpft.':'Beleg erkannt und als Ausgabe gespeichert.');
    return;
  }
'@
  Replace-Required $Main $transactionAnchor ($receiptSubmit + $transactionAnchor) 'Receipt-Speichern'

  $oldWriteActions = "const writeActions = new Set(['starter-categories','categorization-open'"
  $newWriteActions = "const writeActions = new Set(['receipt-camera','receipt-cancel','starter-categories','categorization-open'"
  Replace-Required $Main $oldWriteActions $newWriteActions 'Receipt-Schreibaktionen'

  $accountEditAnchor = "  if (action === 'account-edit') {"
  $receiptActions = @'
  if (action === 'receipt-camera') {
    const input=document.querySelector('#receiptCameraInput');
    if(!input) throw new Error('Belegkamera ist nicht verfügbar.');
    input.value=''; input.click(); return;
  }
  if (action === 'receipt-cancel') {
    resetReceiptState();
    document.querySelector('#receipt-create')?.setAttribute('hidden','');
    return;
  }
'@
  Replace-Required $Main $accountEditAnchor ($receiptActions + $accountEditAnchor) 'Receipt-Aktionen'

  $changeAnchor = "    if (target.id === 'themeSelect') { store.setState({theme:target.value},{persistPreferences:true}); return; }"
  $receiptChange = @'
    if (target.id === 'receiptCameraInput') { await handleReceiptFile(target.files?.[0]); return; }
    if (target.id === 'receiptMode') { setReceiptMode(target.value); return; }
'@
  Replace-Required $Main $changeAnchor ($receiptChange + $changeAnchor) 'Receipt-Change-Handler'

  $formsBlock = @'
.receipt-review-grid {
  display: grid;
  grid-template-columns: minmax(220px,.72fr) minmax(0,1.28fr);
  gap: 20px;
  align-items: start;
}
.receipt-preview-card { display: grid; gap: 12px; position: sticky; top: 88px; }
.receipt-preview { width: 100%; max-height: 520px; object-fit: contain; border: 1px solid var(--border); border-radius: 18px; background: var(--surface-3); }
.receipt-ocr-status { display: grid; gap: 4px; padding: 12px 13px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); }
.receipt-ocr-status strong { font-size: 13px; }
.receipt-ocr-status > span { color: var(--text-3); font-size: 11px; line-height: 1.35; }
.receipt-progress { height: 5px; overflow: hidden; border-radius: 999px; background: var(--surface-3); }
.receipt-progress > span { display: block; width: 0; height: 100%; border-radius: inherit; background: var(--accent); transition: width .18s var(--ease); }
.receipt-match-alert { margin: 0; }
.receipt-ocr-details { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--surface-2); }
.receipt-ocr-details summary { cursor: pointer; color: var(--text-2); font-size: 12px; font-weight: 650; }
.receipt-ocr-text { max-height: 220px; overflow: auto; margin: 10px 0 0; white-space: pre-wrap; color: var(--text-3); font: 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; }
'@
  Append-Required $FormsCss $formsBlock '.receipt-review-grid' 'Receipt-CSS'

  $responsiveBlock = @'
@media (max-width: 660px) {
  .receipt-review-grid { grid-template-columns: 1fr; gap: 14px; }
  .receipt-preview-card { position: static; }
  .receipt-preview { max-height: 360px; border-radius: 16px; }
  .receipt-fields { grid-template-columns: 1fr; }
  .receipt-review .form-actions { position: sticky; bottom: calc(68px + env(safe-area-inset-bottom)); z-index: 5; margin-inline: -4px; padding: 8px 4px; background: color-mix(in srgb,var(--surface) 94%,transparent); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
}
'@
  Append-Required $ResponsiveCss $responsiveBlock '.receipt-review-grid' 'Receipt-Mobile-CSS'

  $oldCsp = "script-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https://bktzavcnaqwdwlwldbjo.supabase.co; worker-src 'self' blob: https://cdnjs.cloudflare.com"
  $newCsp = "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; connect-src 'self' https://bktzavcnaqwdwlwldbjo.supabase.co https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; worker-src 'self' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net"
  Replace-Required $Headers $oldCsp $newCsp 'OCR-CSP'

  $oldReadmeTitle = '# Finance V2.3 – Beta 5.1'
  $newReadmeTitle = @'
# Finance V2.3 – Beta 5.2

## Beta 5.2 – Belegkamera & OCR

- Auf iPhone öffnet `Beleg fotografieren` direkt die rückwärtige Kamera.
- OCR läuft im Browser mit Tesseract.js; das Foto wird für die Erkennung nicht an einen OCR-/KI-Dienst gesendet.
- Finance erkennt Händler, Belegdatum, Währung und Gesamtbetrag und schlägt die bestehende Händlerkategorie vor.
- McDonald's wird als Händler erkannt und auf `Restaurant` vorgeschlagen, sofern diese Kategorie im Haushalt existiert.
- Vor dem Buchen prüft Finance bestehende Bankbuchungen nach Betrag, Währung, Datum und Händler. Ein sicherer Treffer wird verknüpft statt doppelt gebucht.
- Wird keine Bankbuchung gefunden, kann aus dem Beleg eine normale Ausgabe erstellt werden.
- Das Originalfoto wird erst beim Bestätigen in `Dokumente` gespeichert und direkt mit der Transaktion verknüpft.
- OCR ist eine Vorschlagshilfe: Händler, Betrag, Datum, Kategorie und Konto bleiben vor dem Speichern editierbar.
- Keine neue Datenbankmigration; Beta 5.2 nutzt die bestehende Transaktions-, Händler- und Dokumentstruktur.
'@
  Replace-Required $Readme $oldReadmeTitle $newReadmeTitle 'README Beta 5.2'

  $oldVersionTitle = '# Version 2.3.0-beta-5.1'
  $newVersionTitle = @'
# Version 2.3.0-beta-5.2

## V2.3 Beta 5.2 – Receipt Camera

Mobile Belegerfassung mit lokaler OCR, Händler-/Kategorieerkennung, Dublettenprüfung und automatischer Dokumentverknüpfung. Keine Datenbankmigration.

Der Beleg wird zuerst lokal analysiert. Erst nach Bestätigung wird das Foto im bestehenden privaten `finance-documents` Storage gespeichert. Sichere Banktreffer werden verknüpft; Finance legt in diesem Fall keine zweite Ausgabe an.
'@
  Replace-Required $Version $oldVersionTitle $newVersionTitle 'VERSION Beta 5.2'

  Write-Host '3/5 Prüfe die wichtigsten Patch-Marker ...'
  $checks = @(
    @{Path=$Main; Text="from './app/receipt-ocr.js'"},
    @{Path=$Main; Text="id === 'receipt-create'"},
    @{Path=$Transactions; Text='id="receiptCameraInput"'},
    @{Path=$Transactions; Text='Beleg fotografieren'},
    @{Path=$CsvImport; Text="name:\"McDonald's\""},
    @{Path=$Headers; Text='tessdata.projectnaptha.com'},
    @{Path=$Config; Text="version: '2.3.0-beta-5.2'"}
  )
  foreach($check in $checks) {
    if(-not [System.IO.File]::ReadAllText($check.Path).Contains($check.Text)) { throw "Validierung fehlgeschlagen: $($check.Text)" }
  }

  Write-Host '4/5 Erzeuge deploybares Beta-5.2-Paket ...'
  if(Test-Path $Output) { Remove-Item -LiteralPath $Output -Force }
  Compress-Archive -Path $Target -DestinationPath $Output -CompressionLevel Optimal

  Write-Host '5/5 Fertig.'
  Write-Host ''
  Write-Host "Datei: $Output"
  Write-Host 'Diese ZIP kann wie die bisherigen Beta-Pakete entpackt und auf den beta-Branch hochgeladen werden.'
}
finally {
  if(Test-Path $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue }
}
