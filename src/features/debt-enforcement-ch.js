(function(){
  'use strict';
  const VIEW='debtEnforcement';
  let host=null,cases=[],payments=[],busy=false,built=false;
  const $=(s,b)=> (b||document).querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr=(k,v)=>window.AioneI18n?window.AioneI18n.t(k,v):k;
  const ctx=()=>window.AioneContext?window.AioneContext.get():{country:'CH',baseCurrency:'CHF',language:'de-CH'};
  const bridge=()=>window.AioneLegacyBridge||null;
  const money=(v,c)=>window.AioneMoney?window.AioneMoney.format(v,c||'CHF'):String(Number(v||0).toFixed(2))+' '+(c||'CHF');
  const moneyBase=(v,c)=>window.AioneMoney?window.AioneMoney.formatBase(v,c||'CHF'):money(v,c);
  function api(path,opt){const b=bridge();if(!b||!b.request)return Promise.reject(new Error(tr('debt.error.bridge')));return b.request(path,opt)}
  function toast(msg){const b=bridge();if(b&&b.toast)b.toast(msg)}
  function rowsFor(id){return payments.filter(p=>p.case_id===id).sort((a,b)=>String(b.paid_on).localeCompare(String(a.paid_on)))}
  function total(c){return Number(c.original_amount||0)+Number(c.known_interest||0)+Number(c.known_fees||0)}
  function paid(c){return rowsFor(c.id).reduce((s,p)=>s+Number(p.amount||0),0)}
  function remaining(c){return Math.max(0,total(c)-paid(c))}
  function addMonthsISO(months){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+Math.max(0,Number(months||0)));return new Intl.DateTimeFormat(ctx().language||'de-CH',{month:'long',year:'numeric'}).format(d)}
  function projection(c){const rem=remaining(c),m=Number(c.monthly_payment_amount||0);if(!(rem>0))return {months:0,label:tr('debt.projection.covered')};if(!(m>0))return {months:null,label:tr('debt.projection.missing')};const months=Math.ceil(rem/m);return {months,label:tr('debt.projection.value',{months,end:addMonthsISO(months)})}}
  function statusLabel(s){return tr('debt.status.'+(s||'open'))}
  function sourceLabel(s){return tr('debt.source.'+(s||'manual'))}
  function dateLabel(v){if(!v)return'—';try{return new Intl.DateTimeFormat(ctx().language||'de-CH').format(new Date(v+'T12:00:00'))}catch{return v}}
  function summary(){
    const open=cases.filter(c=>!['paid','closed'].includes(c.status)&&remaining(c)>0);
    const remBase=open.reduce((sum,c)=>{const x=window.AioneMoney&&window.AioneMoney.convert?window.AioneMoney.convert(remaining(c),c.currency||'CHF',ctx().baseCurrency,ctx().eurToChf):remaining(c);return sum+Number(x==null?0:x)},0);
    const paidBase=cases.reduce((sum,c)=>{const x=window.AioneMoney&&window.AioneMoney.convert?window.AioneMoney.convert(paid(c),c.currency||'CHF',ctx().baseCurrency,ctx().eurToChf):paid(c);return sum+Number(x==null?0:x)},0);
    return {open:open.length,remaining:remBase,paid:paidBase};
  }
  function render(){
    if(!host)return;
    if(ctx().country!=='CH'){
      host.innerHTML='<div class="debt-page"><div class="debt-hero"><div><span class="debt-kicker">BETA 69 · CH</span><h2>'+tr('debt.title')+'</h2><p>'+tr('debt.chOnly')+'</p></div></div></div>';return;
    }
    const s=summary();
    host.innerHTML='<div class="debt-page">'+
      '<div class="debt-hero"><div><span class="debt-kicker">BETA 69 · SCHWEIZ</span><h2>'+tr('debt.title')+'</h2><p>'+tr('debt.intro')+'</p></div><button class="btn" type="button" data-debt-new>'+tr('debt.addCase')+'</button></div>'+
      '<div class="debt-warning"><strong>'+tr('debt.warning.title')+'</strong><span>'+tr('debt.warning.text')+'</span></div>'+
      '<div class="debt-summary"><div><span>'+tr('debt.summary.remaining')+'</span><strong>'+money(s.remaining,ctx().baseCurrency)+'</strong><small>'+tr('debt.summary.baseCurrency',{currency:ctx().baseCurrency})+'</small></div><div><span>'+tr('debt.summary.paid')+'</span><strong>'+money(s.paid,ctx().baseCurrency)+'</strong><small>'+tr('debt.summary.recorded')+'</small></div><div><span>'+tr('debt.summary.active')+'</span><strong>'+s.open+'</strong><small>'+tr('debt.summary.activeHelp')+'</small></div></div>'+
      '<div class="debt-list">'+(cases.length?cases.map(caseCard).join(''):'<div class="debt-empty"><strong>'+tr('debt.empty.title')+'</strong><p>'+tr('debt.empty.text')+'</p><button class="btn secondary" type="button" data-debt-new>'+tr('debt.addCase')+'</button></div>')+'</div>'+
      '</div>';
  }
  function caseCard(c){
    const ps=rowsFor(c.id),p=projection(c),rem=remaining(c),sumPaid=paid(c),currency=c.currency||'CHF';
    const meta=[c.case_number?tr('debt.caseNumber')+': '+esc(c.case_number):'',c.office_name?esc(c.office_name):'',c.started_on?tr('debt.started')+': '+dateLabel(c.started_on):''].filter(Boolean).join(' · ');
    const history=ps.length?ps.map(x=>'<div class="debt-payment-row"><div><strong>'+money(x.amount,currency)+'</strong><span>'+dateLabel(x.paid_on)+' · '+sourceLabel(x.source)+(x.payroll_period?' · '+tr('debt.payrollPeriod')+' '+esc(x.payroll_period):'')+'</span>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div><button type="button" class="debt-link danger" data-debt-payment-delete="'+x.id+'">'+tr('action.delete')+'</button></div>').join(''):'<div class="debt-payment-empty">'+tr('debt.noPayments')+'</div>';
    return '<article class="debt-case" data-debt-case="'+c.id+'">'+
      '<div class="debt-case-head"><div><span class="debt-status '+esc(c.status||'open')+'">'+statusLabel(c.status)+'</span><h3>'+esc(c.creditor)+'</h3><p>'+meta+'</p></div><div class="debt-case-actions"><button type="button" class="btn secondary" data-debt-payment="'+c.id+'">'+tr('debt.addPayment')+'</button><button type="button" class="btn ghost" data-debt-edit="'+c.id+'">'+tr('action.edit')+'</button></div></div>'+
      '<div class="debt-metrics"><div><span>'+tr('debt.original')+'</span><strong>'+money(c.original_amount,currency)+'</strong></div><div><span>'+tr('debt.costsInterest')+'</span><strong>'+money(Number(c.known_interest||0)+Number(c.known_fees||0),currency)+'</strong></div><div><span>'+tr('debt.paid')+'</span><strong>'+money(sumPaid,currency)+'</strong></div><div class="emphasis"><span>'+tr('debt.remaining')+'</span><strong>'+money(rem,currency)+'</strong></div></div>'+
      '<div class="debt-projection"><div><span>'+tr('debt.monthlyRate')+'</span><strong>'+(c.monthly_payment_amount?money(c.monthly_payment_amount,currency):'—')+'</strong></div><div><span>'+tr('debt.estimate')+'</span><strong>'+esc(p.label)+'</strong></div><small>'+tr('debt.projection.warning')+'</small></div>'+
      '<details class="debt-history"><summary>'+tr('debt.paymentHistory')+' <span>'+ps.length+'</span></summary>'+history+'</details>'+
      (c.notes?'<div class="debt-notes"><strong>'+tr('debt.notes')+'</strong><span>'+esc(c.notes)+'</span></div>':'')+
      '<div class="debt-case-footer"><button type="button" class="debt-link danger" data-debt-delete="'+c.id+'">'+tr('debt.deleteCase')+'</button></div>'+ 
      '</article>';
  }
  async function load(){
    if(busy||ctx().country!=='CH')return;busy=true;
    try{
      const [c,p]=await Promise.all([
        api('/rest/v1/debt_enforcement_cases?select=*&order=created_at.desc'),
        api('/rest/v1/debt_enforcement_payments?select=*&order=paid_on.desc,created_at.desc')
      ]);
      cases=Array.isArray(c)?c:[];payments=Array.isArray(p)?p:[];render();
    }catch(e){host.innerHTML='<div class="debt-page"><div class="debt-error">'+esc(e.message||String(e))+'</div></div>'}
    finally{busy=false}
  }
  function buildDialogs(){
    if($('#debtCaseDialog'))return;
    document.body.insertAdjacentHTML('beforeend','<dialog id="debtCaseDialog" class="debt-dialog"><form id="debtCaseForm" class="dialog-in"><div class="dialog-head"><div><span class="debt-kicker">BETA 69 · CH</span><h2 id="debtCaseDialogTitle">'+tr('debt.addCase')+'</h2></div><button type="button" class="x" data-debt-close="debtCaseDialog">×</button></div><input id="debtCaseId" type="hidden"><div class="form-grid"><div class="field span2"><label>'+tr('debt.creditor')+'</label><input id="debtCreditor" required></div><div class="field"><label>'+tr('debt.caseNumber')+'</label><input id="debtCaseNumber"></div><div class="field"><label>'+tr('debt.office')+'</label><input id="debtOffice"></div><div class="field"><label>'+tr('debt.original')+'</label><input id="debtOriginal" type="number" min="0" step="0.01" required></div><div class="field"><label>'+tr('debt.currency')+'</label><select id="debtCurrency"><option value="CHF">CHF</option><option value="EUR">EUR</option></select></div><div class="field"><label>'+tr('debt.interest')+'</label><input id="debtInterest" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>'+tr('debt.fees')+'</label><input id="debtFees" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>'+tr('debt.monthlyRate')+'</label><input id="debtMonthly" type="number" min="0.01" step="0.01"><div class="small">'+tr('debt.monthlyRate.help')+'</div></div><div class="field"><label>'+tr('debt.started')+'</label><input id="debtStarted" type="date"></div><div class="field"><label>'+tr('debt.status.label')+'</label><select id="debtStatus"><option value="open">'+tr('debt.status.open')+'</option><option value="paused">'+tr('debt.status.paused')+'</option><option value="paid">'+tr('debt.status.paid')+'</option><option value="closed">'+tr('debt.status.closed')+'</option></select></div><div class="field span2"><label>'+tr('debt.notes')+'</label><textarea id="debtNotes" rows="3"></textarea></div></div><div class="debt-form-warning">'+tr('debt.warning.text')+'</div><div id="debtCaseMsg" class="msg hidden"></div><div class="dialog-actions"><button type="button" class="btn secondary" data-debt-close="debtCaseDialog">'+tr('action.cancel')+'</button><button class="btn">'+tr('action.save')+'</button></div></form></dialog>');
    document.body.insertAdjacentHTML('beforeend','<dialog id="debtPaymentDialog" class="debt-dialog"><form id="debtPaymentForm" class="dialog-in"><div class="dialog-head"><div><span class="debt-kicker">'+tr('debt.payment')+'</span><h2 id="debtPaymentTitle">'+tr('debt.addPayment')+'</h2></div><button type="button" class="x" data-debt-close="debtPaymentDialog">×</button></div><input id="debtPaymentCaseId" type="hidden"><div class="form-grid"><div class="field"><label>'+tr('debt.paymentDate')+'</label><input id="debtPaymentDate" type="date" required></div><div class="field"><label>'+tr('debt.paymentAmount')+'</label><input id="debtPaymentAmount" type="number" min="0.01" step="0.01" required></div><div class="field"><label>'+tr('debt.paymentSource')+'</label><select id="debtPaymentSource"><option value="payroll_garnishment">'+tr('debt.source.payroll_garnishment')+'</option><option value="bank_transaction">'+tr('debt.source.bank_transaction')+'</option><option value="manual">'+tr('debt.source.manual')+'</option><option value="other">'+tr('debt.source.other')+'</option></select></div><div class="field"><label>'+tr('debt.payrollPeriod')+'</label><input id="debtPayrollPeriod" type="month"></div><div class="field span2"><label>'+tr('debt.notes')+'</label><textarea id="debtPaymentNotes" rows="3"></textarea></div></div><div class="debt-form-warning">'+tr('debt.payment.help')+'</div><div id="debtPaymentMsg" class="msg hidden"></div><div class="dialog-actions"><button type="button" class="btn secondary" data-debt-close="debtPaymentDialog">'+tr('action.cancel')+'</button><button class="btn">'+tr('action.save')+'</button></div></form></dialog>');
    $('#debtCaseForm').addEventListener('submit',saveCase);$('#debtPaymentForm').addEventListener('submit',savePayment);
    document.body.addEventListener('click',e=>{const b=e.target.closest('[data-debt-close]');if(b){const d=$('#'+b.dataset.debtClose);if(d)d.close()}});
  }
  function msg(id,text,error){const el=$(id);if(!el)return;el.textContent=text||'';el.classList.toggle('hidden',!text);el.classList.toggle('error',!!error)}
  function openCase(id){
    buildDialogs();const c=cases.find(x=>x.id===id);$('#debtCaseForm').reset();$('#debtCaseId').value=c?c.id:'';$('#debtCaseDialogTitle').textContent=c?tr('debt.editCase'):tr('debt.addCase');$('#debtCreditor').value=c?c.creditor:'';$('#debtCaseNumber').value=c&&c.case_number||'';$('#debtOffice').value=c&&c.office_name||'';$('#debtOriginal').value=c?Number(c.original_amount||0):'';$('#debtCurrency').value=c&&c.currency||'CHF';$('#debtInterest').value=c?Number(c.known_interest||0):0;$('#debtFees').value=c?Number(c.known_fees||0):0;$('#debtMonthly').value=c&&c.monthly_payment_amount||'';$('#debtStarted').value=c&&c.started_on||'';$('#debtStatus').value=c&&c.status||'open';$('#debtNotes').value=c&&c.notes||'';msg('#debtCaseMsg','');$('#debtCaseDialog').showModal();
  }
  async function saveCase(e){
    e.preventDefault();if(busy)return;const id=$('#debtCaseId').value,body={country_code:'CH',creditor:$('#debtCreditor').value.trim(),case_number:$('#debtCaseNumber').value.trim()||null,office_name:$('#debtOffice').value.trim()||null,original_amount:Number($('#debtOriginal').value||0),currency:$('#debtCurrency').value,known_interest:Number($('#debtInterest').value||0),known_fees:Number($('#debtFees').value||0),monthly_payment_amount:$('#debtMonthly').value?Number($('#debtMonthly').value):null,started_on:$('#debtStarted').value||null,status:$('#debtStatus').value,notes:$('#debtNotes').value.trim()||null};if(!body.creditor)return msg('#debtCaseMsg',tr('debt.error.creditor'),true);busy=true;try{if(id)await api('/rest/v1/debt_enforcement_cases?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(body)});else await api('/rest/v1/debt_enforcement_cases',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});$('#debtCaseDialog').close();toast(tr('debt.saved'));await load()}catch(er){msg('#debtCaseMsg',er.message||String(er),true)}finally{busy=false}
  }
  function openPayment(id){
    buildDialogs();const c=cases.find(x=>x.id===id);if(!c)return;$('#debtPaymentForm').reset();$('#debtPaymentCaseId').value=id;$('#debtPaymentDate').value=new Date().toISOString().slice(0,10);$('#debtPaymentSource').value='payroll_garnishment';$('#debtPaymentTitle').textContent=tr('debt.addPayment')+' · '+c.creditor;msg('#debtPaymentMsg','');$('#debtPaymentDialog').showModal();
  }
  async function savePayment(e){
    e.preventDefault();if(busy)return;const caseId=$('#debtPaymentCaseId').value,body={case_id:caseId,paid_on:$('#debtPaymentDate').value,amount:Number($('#debtPaymentAmount').value||0),source:$('#debtPaymentSource').value,payroll_period:$('#debtPayrollPeriod').value||null,notes:$('#debtPaymentNotes').value.trim()||null};if(!(body.amount>0))return msg('#debtPaymentMsg',tr('debt.error.amount'),true);busy=true;try{await api('/rest/v1/debt_enforcement_payments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});$('#debtPaymentDialog').close();toast(tr('debt.paymentSaved'));await load()}catch(er){msg('#debtPaymentMsg',er.message||String(er),true)}finally{busy=false}
  }
  async function deleteCase(id){if(!confirm(tr('debt.confirmDelete')))return;busy=true;try{await api('/rest/v1/debt_enforcement_cases?id=eq.'+encodeURIComponent(id),{method:'DELETE'});toast(tr('debt.deleted'));await load()}catch(e){alert(e.message||String(e))}finally{busy=false}}
  async function deletePayment(id){if(!confirm(tr('debt.confirmDeletePayment')))return;busy=true;try{await api('/rest/v1/debt_enforcement_payments?id=eq.'+encodeURIComponent(id),{method:'DELETE'});toast(tr('debt.paymentDeleted'));await load()}catch(e){alert(e.message||String(e))}finally{busy=false}}
  function bindHost(){
    host.addEventListener('click',e=>{const n=e.target.closest('[data-debt-new]'),ed=e.target.closest('[data-debt-edit]'),pay=e.target.closest('[data-debt-payment]'),del=e.target.closest('[data-debt-delete]'),pd=e.target.closest('[data-debt-payment-delete]');if(n)return openCase();if(ed)return openCase(ed.dataset.debtEdit);if(pay)return openPayment(pay.dataset.debtPayment);if(del)return deleteCase(del.dataset.debtDelete);if(pd)return deletePayment(pd.dataset.debtPaymentDelete)});
  }
  function build(){if(built)return;host=$('#debtEnforcementHost');if(!host)return;built=true;bindHost();buildDialogs();render()}
  window.addEventListener('aione:viewchange',e=>{if(e.detail&&e.detail.name===VIEW){build();load()}});
  window.addEventListener('aione69:locale',()=>{if(built){buildDialogs();render()}});
  window.addEventListener('aione69:context',()=>{if(built)render()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
