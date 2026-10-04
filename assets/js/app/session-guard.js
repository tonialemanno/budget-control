export const SESSION_IDLE_OPTIONS = Object.freeze([15,30,60,120]);
export const DEFAULT_IDLE_MINUTES = 30;
export const DEFAULT_WARNING_MINUTES = 5;
export const MAX_SESSION_HOURS = 12;
export const PRESENCE_IDLE_AFTER_MINUTES = 5;

export function normalizeIdleMinutes(value) {
  const parsed=Number(value);
  return SESSION_IDLE_OPTIONS.includes(parsed)?parsed:DEFAULT_IDLE_MINUTES;
}

export function sessionStatus({
  now=Date.now(),
  lastInteractionAt=now,
  sessionStartedAt=now,
  idleMinutes=DEFAULT_IDLE_MINUTES,
  warningMinutes=DEFAULT_WARNING_MINUTES,
  maxSessionHours=MAX_SESSION_HOURS,
}={}) {
  const current=Number(now);
  const last=Number(lastInteractionAt)||current;
  const started=Number(sessionStartedAt)||current;
  const idleMs=normalizeIdleMinutes(idleMinutes)*60_000;
  const warningMs=Math.min(Math.max(1,Number(warningMinutes)||DEFAULT_WARNING_MINUTES)*60_000,idleMs);
  const maxMs=Math.max(1,Number(maxSessionHours)||MAX_SESSION_HOURS)*60*60_000;
  const idleElapsed=Math.max(0,current-last);
  const sessionElapsed=Math.max(0,current-started);
  const idleRemaining=idleMs-idleElapsed;
  const maxRemaining=maxMs-sessionElapsed;
  const remainingMs=Math.min(idleRemaining,maxRemaining);

  if(maxRemaining<=0) return {state:'expired',reason:'max_session',remainingMs:0,idleElapsed,sessionElapsed};
  if(idleRemaining<=0) return {state:'expired',reason:'idle',remainingMs:0,idleElapsed,sessionElapsed};
  if(idleRemaining<=warningMs) return {state:'warning',reason:'idle',remainingMs:idleRemaining,idleElapsed,sessionElapsed};
  return {state:'active',reason:null,remainingMs,idleElapsed,sessionElapsed};
}

export function presenceActivityState({now=Date.now(),lastInteractionAt=now,idleAfterMinutes=PRESENCE_IDLE_AFTER_MINUTES}={}) {
  const elapsed=Math.max(0,Number(now)-(Number(lastInteractionAt)||Number(now)));
  return elapsed>=Math.max(1,Number(idleAfterMinutes)||PRESENCE_IDLE_AFTER_MINUTES)*60_000?'idle':'active';
}

export function formatRemainingMinutes(ms) {
  return Math.max(1,Math.ceil(Math.max(0,Number(ms)||0)/60_000));
}
