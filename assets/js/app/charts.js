import { escapeHtml, money, moneyText } from './format.js';
import { t } from './i18n.js';

function finite(value) {
  const n=Number(value);
  return Number.isFinite(n)?n:0;
}

function monthLabel(date, locale) {
  try { return new Intl.DateTimeFormat(locale,{month:'short'}).format(date).replace('.',''); }
  catch { return String(new Date(date).getMonth()+1); }
}

function financePeriodLabel(row,locale){
  const start=row?.start?new Date(row.start):null;
  const end=row?.endExclusive?new Date(new Date(row.endExclusive).getTime()-1):null;
  if(!start||Number.isNaN(start.getTime())||!end||Number.isNaN(end.getTime())) return monthLabel(row?.date,locale);
  const startMonth=monthLabel(start,locale);
  const endMonth=monthLabel(end,locale);
  return startMonth===endMonth?startMonth:`${startMonth}/${endMonth}`;
}

function compactNumber(value, locale) {
  const n=Math.abs(finite(value));
  try {
    return new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:n>=1000?1:0}).format(n);
  } catch {
    return n>=1000?`${(n/1000).toFixed(1)}k`:Math.round(n).toString();
  }
}

function niceMax(value) {
  const n=Math.max(1,finite(value));
  const power=10**Math.floor(Math.log10(n));
  const scaled=n/power;
  const nice=scaled<=1?1:scaled<=2?2:scaled<=5?5:10;
  return nice*power;
}

export function renderCashflowChart({
  series=[],
  currency='CHF',
  locale='de-CH',
  privacy=false,
}={}) {
  if (!series.length) return `<div class="chart-empty">${escapeHtml(t('Keine Daten für die Entwicklung vorhanden.',locale))}</div>`;

  const width=760;
  const height=280;
  const left=66;
  const right=18;
  const top=18;
  const bottom=42;
  const plotWidth=width-left-right;
  const plotHeight=height-top-bottom;
  const reliable=series.filter((row)=>!row.coverage||row.coverage==='full');
  const scaleRows=reliable.length?reliable:series;
  const maxValue=niceMax(Math.max(...scaleRows.flatMap((row)=>[finite(row.income),finite(row.expenses)]),1));
  const groupWidth=plotWidth/series.length;
  const barWidth=Math.min(24,Math.max(11,groupWidth*.22));
  const gap=Math.max(4,barWidth*.28);
  const y=(value)=>top+plotHeight-(Math.max(0,finite(value))/maxValue*plotHeight);
  const h=(value)=>Math.max(1,Math.max(0,finite(value))/maxValue*plotHeight);

  const grid=[0,.25,.5,.75,1].map((ratio)=>{
    const yy=top+plotHeight-(ratio*plotHeight);
    const label=privacy ? '•••' : `${currency} ${compactNumber(maxValue*ratio,locale)}`;
    return `<g class="cashflow-gridline"><line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}"></line><text x="${left-9}" y="${yy+4}" text-anchor="end">${escapeHtml(label)}</text></g>`;
  }).join('');

  const groups=series.map((row,index)=>{
    const center=left+groupWidth*(index+.5);
    const period=financePeriodLabel(row,locale);
    const coverage=row.coverage||'full';
    if(coverage!=='full'){
      const status=coverage==='partial'?t('Teilweise Daten',locale):t('Keine Daten',locale);
      return `<g class="cashflow-month cashflow-month--incomplete">
        <text class="cashflow-data-gap" x="${center}" y="${top+plotHeight*.53}" text-anchor="middle">${escapeHtml(status)}</text>
        <text class="cashflow-month-label" x="${center}" y="${height-14}" text-anchor="middle">${escapeHtml(period)}</text>
      </g>`;
    }
    const incomeX=center-gap/2-barWidth;
    const expenseX=center+gap/2;
    const incomeY=y(row.income);
    const expenseY=y(row.expenses);
    const incomeH=h(row.income);
    const expenseH=h(row.expenses);
    const incomeTitle=privacy
      ? `${t('Einnahmen',locale)} · ${period}`
      : `${t('Einnahmen',locale)} · ${period}: ${moneyText(row.income,{currency,locale})}`;
    const expenseTitle=privacy
      ? `${t('Ausgaben',locale)} · ${period}`
      : `${t('Ausgaben',locale)} · ${period}: ${moneyText(row.expenses,{currency,locale})}`;
    return `<g class="cashflow-month">
      <rect class="cashflow-bar cashflow-bar--income" x="${incomeX}" y="${incomeY}" width="${barWidth}" height="${incomeH}" rx="5"><title>${escapeHtml(incomeTitle)}</title></rect>
      <rect class="cashflow-bar cashflow-bar--expense" x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${expenseH}" rx="5"><title>${escapeHtml(expenseTitle)}</title></rect>
      <text class="cashflow-month-label" x="${center}" y="${height-14}" text-anchor="middle">${escapeHtml(period)}</text>
    </g>`;
  }).join('');

  const latest=series[series.length-1]||{};
  const incomplete=series.some((row)=>row.coverage&&row.coverage!=='full');
  return `<div class="cashflow-chart">
    <div class="chart-legend" aria-hidden="true">
      <span><i class="legend-dot legend-dot--income"></i>${escapeHtml(t('Einnahmen',locale))}</span>
      <span><i class="legend-dot legend-dot--expense"></i>${escapeHtml(t('Ausgaben',locale))}</span>
    </div>
    <svg class="cashflow-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t('Einnahmen und Ausgaben der letzten sechs Finanzmonate',locale))}" preserveAspectRatio="xMidYMid meet">
      ${grid}
      ${groups}
    </svg>
    ${incomplete?`<p class="cashflow-data-note">${escapeHtml(t('Unvollständige Historie wird nicht als CHF 0 dargestellt.',locale))}</p>`:''}
    <div class="cashflow-summary">
      <span>${escapeHtml(t('Aktueller Finanzmonat · Einnahmen',locale))} <strong>${privacy?'•••':money(latest.income||0,{currency,locale,decimals:0})}</strong></span>
      <span>${escapeHtml(t('Aktueller Finanzmonat · Ausgaben',locale))} <strong>${privacy?'•••':money(latest.expenses||0,{currency,locale,decimals:0})}</strong></span>
    </div>
  </div>`;
}

export function renderExpenseDonut({
  rows=[],
  total=0,
  currency='CHF',
  locale='de-CH',
  privacy=false,
}={}) {
  const value=Math.max(0,finite(total));
  if (!(value>0) || !rows.length) {
    return `<div class="donut-empty"><div class="donut-empty-ring"></div><p>${escapeHtml(t('Keine Ausgaben in diesem Finanzmonat.',locale))}</p></div>`;
  }

  const radius=52;
  const circumference=2*Math.PI*radius;
  let offset=0;
  const segments=rows.map((row,index)=>{
    const share=Math.max(0,finite(row.share));
    const length=circumference*(share/100);
    const dashOffset=-offset;
    offset+=length;
    const displayLabel=row.key==='uncategorized' ? t('Ohne Kategorie',locale) : row.key==='other' ? t('Sonstiges',locale) : row.label;
    const title=privacy
      ? `${displayLabel}: ${Math.round(share)}%`
      : `${displayLabel}: ${moneyText(row.value,{currency,locale})} · ${Math.round(share)}%`;
    const categoryIds=Array.isArray(row.categoryIds)?row.categoryIds.join(','):'';
    return `<circle class="donut-segment donut-segment--${index%6} donut-segment--interactive" cx="70" cy="70" r="${radius}" pathLength="${circumference}" stroke-dasharray="${length} ${Math.max(0,circumference-length)}" stroke-dashoffset="${dashOffset}" tabindex="0" role="button" data-action="overview-drilldown-expense" data-key="${escapeHtml(row.key)}" data-category-ids="${escapeHtml(categoryIds)}"><title>${escapeHtml(title)}</title></circle>`;
  }).join('');

  const legend=rows.map((row,index)=>{
    const displayLabel=row.key==='uncategorized' ? t('Ohne Kategorie',locale) : row.key==='other' ? t('Sonstiges',locale) : row.label;
    const categoryIds=Array.isArray(row.categoryIds)?row.categoryIds.join(','):'';
    return `<button class="donut-legend-row donut-legend-button" type="button" data-action="overview-drilldown-expense" data-key="${escapeHtml(row.key)}" data-category-ids="${escapeHtml(categoryIds)}">
      <span class="donut-legend-dot donut-segment-bg--${index%6}"></span>
      <strong>${escapeHtml(displayLabel)}</strong>
      <span>${privacy?'•••':money(row.value,{currency,locale,decimals:0})}</span>
      <small>${Math.round(row.share)}%</small>
    </button>`;
  }).join('');

  return `<div class="donut-layout">
    <div class="donut-visual">
      <svg class="donut-svg" viewBox="0 0 140 140" role="img" aria-label="${escapeHtml(t('Ausgaben nach Kategorien im aktuellen Finanzmonat',locale))}">
        <circle class="donut-track" cx="70" cy="70" r="${radius}"></circle>
        <g transform="rotate(-90 70 70)">${segments}</g>
        <text class="donut-center-label" x="70" y="65" text-anchor="middle">${escapeHtml(t('Ausgaben',locale))}</text>
        <text class="donut-center-value" x="70" y="82" text-anchor="middle">${privacy?'•••':`${escapeHtml(currency)} ${escapeHtml(compactNumber(value,locale))}`}</text>
      </svg>
    </div>
    <div class="donut-legend">${legend}</div>
  </div>`;
}



export function renderIncomePlan({
  flow={},
  currency='CHF',
  locale='de-CH',
  privacy=false,
}={}) {
  const income=Math.max(0,finite(flow.income));
  const fixed=Math.max(0,finite(flow.fixed));
  const reserves=Math.max(0,finite(flow.reserves));
  const variable=Math.max(0,finite(flow.variable));
  const committed=fixed+reserves+variable;
  const free=Math.max(0,income-committed);
  const gap=Math.max(0,committed-income);
  if(!(income>0)&&!(committed>0)) return `<div class="chart-empty">${escapeHtml(t('Noch nicht genug Planungsdaten für den Monatsplan.',locale))}</div>`;

  const amount=(value)=>privacy?'•••':money(value,{currency,locale,decimals:0});
  const percent=(value)=>income>0?Math.round(value/income*100):0;
  const rows=[
    {label:'Fixkosten',value:fixed},
    {label:'Sparen & Rücklagen',value:reserves},
    {label:'Variable Ausgaben geplant',value:variable},
  ];
  return `<div class="income-plan">
    <div class="income-plan-income">
      <span>${escapeHtml(t('Geplantes Einkommen',locale))}</span>
      <strong>${escapeHtml(amount(income))}</strong>
    </div>
    <div class="income-plan-rows">
      ${rows.map((row)=>`<div class="income-plan-row">
        <div><span>${escapeHtml(t(row.label,locale))}</span><small>${income>0?`${percent(row.value)}%`:''}</small></div>
        <strong>− ${escapeHtml(amount(row.value))}</strong>
      </div>`).join('')}
    </div>
    <div class="income-plan-result ${gap>0?'income-plan-result--negative':''}">
      <div><span>${escapeHtml(t(gap>0?'Über Plan':'Voraussichtlich frei',locale))}</span><small>${escapeHtml(t(gap>0?'Verpflichtungen übersteigen das geplante Einkommen.':'Nach deinem aktuellen Monatsplan.',locale))}</small></div>
      <strong>${escapeHtml(amount(gap>0?gap:free))}</strong>
    </div>
  </div>`;
}

export function renderMoneyFlow({
  flow={},
  currency='CHF',
  locale='de-CH',
  privacy=false,
}={}) {
  const rows=[
    {key:'fixed',label:'Fixkosten',value:Math.max(0,finite(flow.fixed))},
    {key:'reserves',label:'Rücklagen & Sparen',value:Math.max(0,finite(flow.reserves))},
    {key:'variable',label:'Variable Ausgaben',value:Math.max(0,finite(flow.variable))},
    {key:'free',label:'Frei verfügbar',value:Math.max(0,finite(flow.free))},
  ].filter((row)=>row.value>0);
  const income=Math.max(0,finite(flow.income));
  const gap=Math.max(0,finite(flow.gap));
  if(gap>0) rows.push({key:'gap',label:'Über Plan',value:gap});
  if(!rows.length && !(income>0)) return '<div class="chart-empty">Noch nicht genug Planungsdaten für den Geldfluss.</div>';

  const width=920;
  const height=310;
  const top=28;
  const bottom=28;
  const sourceX=70;
  const sourceW=26;
  const targetX=760;
  const targetW=28;
  const plotH=height-top-bottom;
  const gapY=12;
  const totalRows=Math.max(1,rows.length);
  const availableH=plotH-gapY*(totalRows-1);
  const branchTotal=Math.max(1,rows.reduce((sum,row)=>sum+row.value,0));
  const maxTotal=Math.max(income,branchTotal,1);
  const sourceH=plotH*(income/maxTotal);
  const sourceY=top+(plotH-sourceH)/2;
  let sourceCursor=sourceY;
  let targetCursor=top;

  const bands=rows.map((row,index)=>{
    const thickness=Math.max(6,plotH*(row.value/maxTotal));
    const targetH=Math.max(24,availableH*(row.value/branchTotal));
    const sy1=sourceCursor;
    const sy2=sourceCursor+thickness;
    const ty1=targetCursor+(targetH-thickness)/2;
    const ty2=ty1+thickness;
    sourceCursor+=thickness;
    targetCursor+=targetH+gapY;
    const c1=sourceX+170;
    const c2=targetX-170;
    const d=[
      `M ${sourceX+sourceW} ${sy1}`,
      `C ${c1} ${sy1}, ${c2} ${ty1}, ${targetX} ${ty1}`,
      `L ${targetX} ${ty2}`,
      `C ${c2} ${ty2}, ${c1} ${sy2}, ${sourceX+sourceW} ${sy2}`,
      'Z',
    ].join(' ');
    const amount=privacy?'•••':moneyText(row.value,{currency,locale,decimals:0});
    return `<g class="money-flow-branch money-flow-branch--${row.key}">
      <path d="${d}"></path>
      <rect x="${targetX}" y="${targetCursor-targetH-gapY}" width="${targetW}" height="${targetH}" rx="8"></rect>
      <text class="money-flow-label" x="${targetX+targetW+14}" y="${targetCursor-targetH-gapY+targetH/2-2}">${escapeHtml(t(row.label,locale))}</text>
      <text class="money-flow-value" x="${targetX+targetW+14}" y="${targetCursor-targetH-gapY+targetH/2+15}">${escapeHtml(amount)}</text>
    </g>`;
  }).join('');

  const incomeText=privacy?'•••':moneyText(income,{currency,locale,decimals:0});
  const note=gap>0
    ? `<div class="money-flow-note money-flow-note--warning">${escapeHtml(t('Geplante Verpflichtungen liegen über dem geplanten Einkommen.',locale))}</div>`
    : '';

  return `<div class="money-flow">
    <svg class="money-flow-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(t('Geldfluss des geplanten Finanzmonats',locale))}" preserveAspectRatio="xMidYMid meet">
      <g class="money-flow-source">
        <rect x="${sourceX}" y="${sourceY}" width="${sourceW}" height="${Math.max(14,sourceH)}" rx="8"></rect>
        <text class="money-flow-source-label" x="${sourceX}" y="${Math.max(18,sourceY-9)}">${escapeHtml(t('Geplantes Einkommen',locale))}</text>
        <text class="money-flow-source-value" x="${sourceX}" y="${Math.min(height-8,sourceY+Math.max(14,sourceH)+19)}">${escapeHtml(incomeText)}</text>
      </g>
      ${bands}
    </svg>
    ${note}
  </div>`;
}
