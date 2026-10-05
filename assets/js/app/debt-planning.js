import { addMonthsClamped } from './recurrence.js';

export const DEBT_TERM_OPTIONS=Object.freeze([12,24,36,48,60]);

function localDate(value){
  const text=String(value||'').slice(0,10);
  if(!text) return null;
  const date=new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime())?null:date;
}

export function debtEndDate(startDate,termMonths){
  const start=localDate(startDate);
  const months=Number(termMonths||0);
  if(!start||!Number.isInteger(months)||months<=0) return null;
  return addMonthsClamped(start,months-1);
}

export function debtEndDateValue(startDate,termMonths){
  const end=debtEndDate(startDate,termMonths);
  if(!end) return null;
  return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
}

export function debtTermMonthsFromDates(startDate,endDate){
  const start=localDate(startDate);
  const end=localDate(endDate);
  if(!start||!end||end<start) return null;
  const months=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth())+1;
  return months>0?months:null;
}

export function debtTermMonths(debt){
  const stored=Number(debt?.term_months||0);
  if(Number.isInteger(stored)&&stored>0) return stored;
  return debtTermMonthsFromDates(debt?.start_date,debt?.end_date);
}

export function debtScheduleSummary(debt){
  const term=debtTermMonths(debt);
  const rate=Math.max(0,Number(debt?.installment_amount||0));
  const scheduled=term&&rate?term*rate:0;
  const original=Math.max(0,Number(debt?.original_amount||0));
  return {
    termMonths:term,
    scheduledTotal:scheduled,
    amountDifference:term&&rate?original-scheduled:0,
    endDate:debtEndDateValue(debt?.start_date,term),
  };
}
