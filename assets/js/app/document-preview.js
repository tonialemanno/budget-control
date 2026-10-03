import { financeApi } from './finance-api.js';
import { t } from './i18n.js';

let activeUrl=null, activeBlob=null, activeName='';

function cleanup(){ if(activeUrl) URL.revokeObjectURL(activeUrl); activeUrl=null; activeBlob=null; activeName=''; }
function closePreview(){ document.querySelector('#documentPreviewModal')?.remove(); cleanup(); document.body.classList.remove('document-preview-open'); }
function saveBlob(blob,name){ const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=name||'dokument';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500); }
function esc(value){ return String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }

function markup({name,mime,url}){
  const pdf=String(mime||'').toLowerCase()==='application/pdf'||String(name||'').toLowerCase().endsWith('.pdf');
  const content=pdf?`<iframe class="document-preview-frame" src="${url}" title="${esc(name)}"></iframe>`:`<div class="document-preview-image-wrap"><img class="document-preview-image" src="${url}" alt="${esc(name)}"></div>`;
  return `<div class="document-preview-backdrop" id="documentPreviewModal" role="dialog" aria-modal="true" aria-label="${esc(t('Dokumentvorschau'))}"><section class="document-preview-sheet"><header class="document-preview-header"><div class="document-preview-title"><strong>${esc(name)}</strong><span>${esc(t(pdf?'PDF-Vorschau':'Bildvorschau'))}</span></div><button class="icon-button document-preview-close" type="button" data-document-preview-close aria-label="${esc(t('Vorschau schliessen'))}">×</button></header><div class="document-preview-body">${content}</div><footer class="document-preview-actions"><button class="action-button action-button--secondary" type="button" data-document-preview-close>${esc(t('Schliessen'))}</button><button class="action-button action-button--primary" type="button" data-document-preview-download>${esc(t('Herunterladen'))}</button></footer></section></div>`;
}

async function openPreview(target){
  const path=target.dataset.path,name=target.dataset.name||'Dokument',mime=target.dataset.mime||'';
  if(!path) throw new Error(t('Dokumentpfad fehlt.'));
  target.disabled=true; const old=target.textContent; target.textContent=t('Lade …');
  try{
    closePreview();
    activeBlob=await financeApi.downloadDocument(path); activeName=name; activeUrl=URL.createObjectURL(activeBlob);
    document.body.insertAdjacentHTML('beforeend',markup({name,mime:mime||activeBlob.type,url:activeUrl}));
    document.body.classList.add('document-preview-open');
  } finally { target.disabled=false; target.textContent=old; }
}

document.addEventListener('click',async(event)=>{
  const preview=event.target.closest('[data-action="document-preview"]');
  if(preview){event.preventDefault();try{await openPreview(preview);}catch(error){alert(`${t('Vorschau konnte nicht geöffnet werden')}: ${String(error?.message||error)}`);}return;}
  if(event.target.closest('[data-document-preview-close]')||event.target.id==='documentPreviewModal'){event.preventDefault();closePreview();return;}
  if(event.target.closest('[data-document-preview-download]')){event.preventDefault();if(activeBlob)saveBlob(activeBlob,activeName);}
});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&document.querySelector('#documentPreviewModal'))closePreview();});
window.addEventListener('hashchange',closePreview);
