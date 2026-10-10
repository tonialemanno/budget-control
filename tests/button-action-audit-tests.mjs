import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const viewsDir=new URL('../assets/js/views/',import.meta.url);
const viewPaths=fs.readdirSync(viewsDir).filter(x=>x.endsWith('.js')).map(x=>'assets/js/views/'+x);
const components=read('assets/js/app/components.js');
const renderers=viewPaths.map(p=>({path:p,source:read(p)}));
const actionSources=[
  'assets/js/main.js','assets/js/app/receipt-controller.js','assets/js/app/document-preview.js'
].map(read).join('\n');
const foundActions=new Map();
const formIds=new Map();
const inertButtons=[];
let buttonCount=0,actionCount=0,formCount=0,drilldownCount=0;
for(const {path,source} of renderers){
  const content=source;
  for(const m of content.matchAll(/data-action=["']([^"'$<>]+)["']/g)){
    actionCount++;
    if(!foundActions.has(m[1]))foundActions.set(m[1],[]);
    foundActions.get(m[1]).push(path);
  }
  for(const m of content.matchAll(/data-form=["']([^"'$<>]+)["']/g)){
    formCount++;
    if(!formIds.has(m[1]))formIds.set(m[1],[]);
    formIds.get(m[1]).push(path);
  }
  drilldownCount+=(content.match(/data-drilldown=/g)||[]).length;
  for(const button of content.matchAll(/<button\b[^>]*>/g)){
    buttonCount++;
    const markup=button[0];
    if(!/data-action=|type=["']submit["']|type=\\?"submit\\?"|data-drilldown=|onclick=|data-document-preview|data-target=|data-form=|data-logout|data-csv-|data-review-|data-modal-/.test(markup)){
      inertButtons.push(path+': '+markup.slice(0,170));
    }
  }
}
const regexEscape=(s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const handlers=new Set();
const unmatched=[];
for(const [action,locations] of foundActions){
  if(actionSources.includes(action))handlers.add(action);
  else unmatched.push({action,locations:[...new Set(locations)]});
}
const missingFormHandlers=[...formIds.keys()].filter(f=>!actionSources.includes(f));
for(const required of ['admin-demo-restore','admin-demo-password-reset','goal-edit','vehicle-edit','family-remove','receipt-camera','review-jump-section']){
  assert.ok(handlers.has(required),'Important action has no detected handler: '+required);
}
assert.ok(buttonCount>=60,'Unexpectedly few buttons covered');
console.log('UI button action audit: '+buttonCount+' authored buttons; '+foundActions.size+' unique actions; '+formIds.size+' unique forms; '+drilldownCount+' drilldown references.');
console.log('ACTIONS_NEED_MANUAL_REVIEW='+JSON.stringify(unmatched));
console.log('FORMS_NEED_MANUAL_REVIEW='+JSON.stringify(missingFormHandlers));
console.log('BUTTONS_NEED_MANUAL_REVIEW='+JSON.stringify(inertButtons.slice(0,100)));
