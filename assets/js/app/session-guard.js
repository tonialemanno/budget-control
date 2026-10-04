const PREFIX='finance-session-security';

function safeNumber(value,fallback){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

export function classifyPresence(lastSeenAt,{
  activeWithinMs=95_000,
  offlineAfterMs=30*60_000,
  now=Date.now(),
}={}){
  if(!lastSeenAt) return {state:'offline',label:'Offline',seconds:null};
  const seen=new Date(lastSeenAt).getTime();
  if(!Number.isFinite(seen)) return {state:'offline',label:'Offline',seconds:null};
  const elapsed=Math.max(0,now-seen);
  if(elapsed<=activeWithinMs) return {state:'active',label:'Aktiv',seconds:elapsed/1000};
  if(elapsed<offlineAfterMs) return {state:'idle',label:'Inaktiv',seconds:elapsed/1000};
  return {state:'offline',label:'Offline',seconds:elapsed/1000};
}

export function createSessionGuard({
  userId,
  idleTimeoutMs=30*60_000,
  warningLeadMs=5*60_000,
  maxSessionMs=12*60*60_000,
  now=()=>Date.now(),
  storage=typeof localStorage!=='undefined'?localStorage:null,
  onWarning=()=>{},
  onWarningClear=()=>{},
  onTimeout=()=>{},
}={}){
  if(!userId) throw new Error('Session guard needs a user id.');

  const lastActivityKey=`${PREFIX}:last-activity:${userId}`;
  const sessionStartKey=`${PREFIX}:started:${userId}`;
  let timer=null;
  let stopped=false;
  let timedOut=false;

  const read=(key,fallback)=>{
    if(!storage) return fallback;
    return safeNumber(storage.getItem(key),fallback);
  };
  const write=(key,value)=>{ try{ storage?.setItem(key,String(value)); }catch{} };
  const remove=(key)=>{ try{ storage?.removeItem(key); }catch{} };

  const startedAt=read(sessionStartKey,now());
  if(!read(sessionStartKey,0)) write(sessionStartKey,startedAt);
  if(!read(lastActivityKey,0)) write(lastActivityKey,now());

  function snapshot(){
    const current=now();
    const lastActivity=read(lastActivityKey,current);
    const sessionStarted=read(sessionStartKey,startedAt);
    const idleFor=Math.max(0,current-lastActivity);
    const sessionFor=Math.max(0,current-sessionStarted);
    const idleRemaining=idleTimeoutMs-idleFor;
    const sessionRemaining=maxSessionMs-sessionFor;
    const remaining=Math.min(idleRemaining,sessionRemaining);
    return {
      current,lastActivity,sessionStarted,idleFor,sessionFor,
      idleRemaining,sessionRemaining,remaining,
      warning:remaining>0&&remaining<=warningLeadMs,
      expired:remaining<=0,
      idle:idleFor>=Math.min(5*60_000,idleTimeoutMs),
    };
  }

  function check(){
    if(stopped||timedOut) return snapshot();
    const state=snapshot();
    if(state.expired){
      timedOut=true;
      onWarningClear();
      onTimeout({
        reason:state.sessionRemaining<=0?'max_session':'idle',
        idleFor:state.idleFor,
        sessionFor:state.sessionFor,
      });
      return state;
    }
    if(state.warning) onWarning(state.remaining);
    else onWarningClear();
    return state;
  }

  function activity(){
    if(stopped||timedOut) return;
    write(lastActivityKey,now());
    onWarningClear();
  }

  function start(){
    if(timer) clearInterval(timer);
    stopped=false;
    check();
    timer=setInterval(check,15_000);
  }

  function stop({clear=false}={}){
    stopped=true;
    if(timer) clearInterval(timer);
    timer=null;
    onWarningClear();
    if(clear){
      remove(lastActivityKey);
      remove(sessionStartKey);
    }
  }

  return {
    start,
    stop,
    activity,
    check,
    snapshot,
    isIdle(){ return snapshot().idle; },
  };
}
