import { escapeHtml, money } from './format.js';

function finite(value) {
  const n=Number(value);
  return Number.isFinite(n)?n:0;
}

function monthLabel(date, locale) {
  try { return new Intl.DateTimeFormat(locale,{month:'short'}).format(date).replace('.',''); }
  catch { return String(new Date(date).getMonth()+1); }
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
}={}) {
  if (!series.length) return '<div class="chart-empty">Keine Daten für die Entwicklung vorhanden.</div>';

  const width=760;
  const height=280;
  const left=66;
  const right=18;
  const top=18;
  const bottom=42;
  const plotWidth=width-left-right;
  const plotHeight=height-top-bottom;
  const maxValue=niceMax(Math.max(...series.flatMap((row)=>[finite(row.income),finite(row.expenses)]),1));
  const groupWidth=plotWidth/series.length;
  const barWidth=Math.min(24,Math.max(11,groupWidth*.22));
  const gap=Math.max(4,barWidth*.28);
  const y=(value)=>top+plotHeight-(Math.max(0,finite(value))/maxValue*plotHeight);
  const h=(value)=>Math.max(1,Math.max(0,finite(value))/maxValue*plotHeight);

  const grid=[0,.25,.5,.75,1].map((ratio)=>{
    const yy=top+plotHeight-(ratio*plotHeight);
    const label=`${currency} ${compactNumber(maxValue*ratio,locale)}`;
    return `<g class="cashflow-gridline"><line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}"></line><text x="${left-9}" y="${yy+4}" text-anchor="end">${escapeHtml(label)}</text></g>`;
  }).join('');

  const groups=series.map((row,index)=>{
    const center=left+groupWidth*(index+.5);
    const incomeX=center-gap/2-barWidth;
    const expenseX=center+gap/2;
    const incomeY=y(row.income);
    const expenseY=y(row.expenses);
    const incomeH=h(row.income);
    const expenseH=h(row.expenses);
    const month=monthLabel(row.date,locale);
    const incomeTitle=`Einnahmen · ${month}: ${money(row.income,{currency,locale})}`;
    const expenseTitle=`Ausgaben · ${month}: ${money(row.expenses,{currency,locale})}`;
    return `<g class="cashflow-month">
      <rect class="cashflow-bar cashflow-bar--income" x="${incomeX}" y="${incomeY}" width="${barWidth}" height="${incomeH}" rx="5"><title>${escapeHtml(incomeTitle)}</title></rect>
      <rect class="cashflow-bar cashflow-bar--expense" x="${expenseX}" y="${expenseY}" width="${barWidth}" height="${expenseH}" rx="5"><title>${escapeHtml(expenseTitle)}</title></rect>
      <text class="cashflow-month-label" x="${center}" y="${height-14}" text-anchor="middle">${escapeHtml(month)}</text>
    </g>`;
  }).join('');

  const latest=series[series.length-1]||{};
  return `<div class="cashflow-chart">
    <div class="chart-legend" aria-hidden="true">
      <span><i class="legend-dot legend-dot--income"></i>Einnahmen</span>
      <span><i class="legend-dot legend-dot--expense"></i>Ausgaben</span>
    </div>
    <svg class="cashflow-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Einnahmen und Ausgaben der letzten sechs Monate" preserveAspectRatio="xMidYMid meet">
      ${grid}
      ${groups}
    </svg>
    <div class="cashflow-summary">
      <span>Aktueller Monat · Einnahmen <strong>${money(latest.income||0,{currency,locale,decimals:0})}</strong></span>
      <span>Aktueller Monat · Ausgaben <strong>${money(latest.expenses||0,{currency,locale,decimals:0})}</strong></span>
    </div>
  </div>`;
}

export function renderExpenseDonut({
  rows=[],
  total=0,
  currency='CHF',
  locale='de-CH',
}={}) {
  const value=Math.max(0,finite(total));
  if (!(value>0) || !rows.length) {
    return `<div class="donut-empty"><div class="donut-empty-ring"></div><p>Keine Ausgaben in diesem Monat.</p></div>`;
  }

  const radius=52;
  const circumference=2*Math.PI*radius;
  let offset=0;
  const segments=rows.map((row,index)=>{
    const share=Math.max(0,finite(row.share));
    const length=circumference*(share/100);
    const dashOffset=-offset;
    offset+=length;
    const title=`${row.label}: ${money(row.value,{currency,locale})} · ${Math.round(share)}%`;
    return `<circle class="donut-segment donut-segment--${index%6}" cx="70" cy="70" r="${radius}" pathLength="${circumference}" stroke-dasharray="${length} ${Math.max(0,circumference-length)}" stroke-dashoffset="${dashOffset}"><title>${escapeHtml(title)}</title></circle>`;
  }).join('');

  const legend=rows.map((row,index)=>`<div class="donut-legend-row">
    <span class="donut-legend-dot donut-segment-bg--${index%6}"></span>
    <strong>${escapeHtml(row.label)}</strong>
    <span>${money(row.value,{currency,locale,decimals:0})}</span>
    <small>${Math.round(row.share)}%</small>
  </div>`).join('');

  return `<div class="donut-layout">
    <div class="donut-visual">
      <svg class="donut-svg" viewBox="0 0 140 140" role="img" aria-label="Ausgaben nach Kategorien im aktuellen Monat">
        <circle class="donut-track" cx="70" cy="70" r="${radius}"></circle>
        <g transform="rotate(-90 70 70)">${segments}</g>
        <text class="donut-center-label" x="70" y="65" text-anchor="middle">Ausgaben</text>
        <text class="donut-center-value" x="70" y="82" text-anchor="middle">${escapeHtml(currency)} ${escapeHtml(compactNumber(value,locale))}</text>
      </svg>
    </div>
    <div class="donut-legend">${legend}</div>
  </div>`;
}
