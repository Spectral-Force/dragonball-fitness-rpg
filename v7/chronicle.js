import { CATALOG, STATS } from './catalog.js';
import { getPower, localDate } from './engine.js';
import { getEffectivePhysicalRecord } from './history-corrections.js';

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const n = value => finite(value) ? Number(value) : 0;
const positive = value => Math.max(0,n(value));
const copyStats = (source,missing=0) => Object.fromEntries(STATS.map(key => [key, finite(source?.[key]) ? Number(source[key]) : missing]));
const sameStats = (a,b) => STATS.every(key=>Math.abs(n(a?.[key])-n(b?.[key]))<1e-7);
const datePart = value => {
  const date=/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(String(value))?String(value).slice(0,10):null;
  if(!date)return null;
  const [y,m,d]=date.split('-').map(Number),parsed=new Date(Date.UTC(y,m-1,d));
  return y>=1970&&y<=2200&&parsed.toISOString().slice(0,10)===date?date:null;
};
const eventDate = event => datePart(event.date || event.createdAt || event.at || event.timestamp);
const eventPower = event => event.powerAfter?.effective ?? event.powerAfter ?? event.power?.after?.effective ?? event.power?.after;
const activeEvent = event => !(event.entitlement && event.active === false);
const ordered = rows => rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
const monday = date => {const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const creditDate = (workout,migrationDate) => migrationDate&&workout.date<migrationDate?[migrationDate,datePart(workout.createdAt)].filter(Boolean).sort().at(-1):workout.date;
export const STAT_LABELS = { STR:'Strength', END:'Endurance', AGI:'Agility', VIT:'Vitality', SPI:'Spirit', TEC:'Technique', GKI:'God Ki' };
export const STAT_COLOURS = { STR:'#ffab60', END:'#65b9ff', AGI:'#79e8b0', VIT:'#ff789e', SPI:'#c394ff', TEC:'#63ded5', GKI:'#ffe289', BASE:'#f7edce', PL:'#ffcb70' };
export function legacyCharacter(state, character) { return state?.migration?.original?.characters?.[character.legacy?.originalCharacterId || character.id] || null; }

function powerAt(stats,character,source=null){
  const plain={race:source?.race||character.race,routeId:source?.routeId||character.routeId,stats,activeForm:'base',forms:{base:{level:1}},earnedBands:['base']};
  const base=getPower(plain).base;
  if(!source||!Array.isArray(source.earnedBands)||typeof source.activeForm!=='string'||!source.forms)return {base,effective:null};
  const recorded=getPower({...plain,...source,stats},{historical:true});
  return {base:recorded.base,effective:recorded.effective};
}

/** Derive a display timeline from recorded facts, never from today's training boosts. */
export function statTimeline(character, state = {}, today = localDate()) {
  today=datePart(today)||localDate();
  const old = legacyCharacter(state, character), points = [], events = [],undatedEvents=[];
  const workouts=ordered((character.workouts||[]).filter(w=>!w.legacy&&w.receipt&&datePart(w.date)&&w.date<=today));
  const migrationDate = old ? datePart(state.migration?.migratedAt) : null;
  const history = Array.isArray(old?.history) ? old.history : [];
  for (const entry of history) {
    const date = datePart(entry.date);
    if (!date || date>today || !entry.stats || !STATS.some(key=>finite(entry.stats[key])) || migrationDate && date > migrationDate) continue;
    points.push({date,stats:copyStats(entry.stats,null),base:finite(entry.basePL)?Number(entry.basePL):null,power:finite(entry.pl??entry.powerLevel)?Number(entry.pl??entry.powerLevel):null,bodyWeight:finite(entry.bw)?Number(entry.bw):null,source:'v6 recorded snapshot',legacy:true,baseline:!!entry.baseline});
  }
  const hasLegacyHistory=points.length>0;
  let running = copyStats(character.baseline?.stats || CATALOG.startingStats[character.race]);
  const firstDate = workouts[0]?.date;
  const startDate = migrationDate || [datePart(character.createdAt), firstDate, today].filter(Boolean).sort()[0];
  const initial=powerAt(running,character),isOpening=!old&&sameStats(running,CATALOG.startingStats[character.race]);
  points.push({date:startDate,stats:copyStats(running),base:initial.base,power:finite(character.baseline?.power)?Number(character.baseline.power):isOpening?initial.base:null,source:old?'Preserved migration balance':'Starting stats',boundary:!!old,baseline:true});
  if (old) events.push({date:startDate, kind:'migration', title:'v6 → v7: preserved balance; historical gaps are not interpolated'});
  // A v7 entry backdated before migration cannot establish pre-migration totals.
  // Place its credited gains on the recorded entry date and retain the workout date.
  const ledger=workouts.map(workout=>({date:creditDate(workout,migrationDate),createdAt:workout.createdAt||'',kind:'workout',workout}));
  for (const event of character.journal || []) {
    if(!activeEvent(event))continue;
    const date=eventDate(event),kind=event.kind||event.type||'event',title=event.title||event.name||event.label||kind;
    const hasStats=STATS.some(key=>n(event.reward?.stats?.[key])!==0),hasPower=finite(eventPower(event)),milestone=/saga|awaken|form|milestone|breakthrough|mastery/.test(kind);
    if(!date){if(hasStats||hasPower||milestone)undatedEvents.push({kind,title,hasStats});continue;}
    if(date>today)continue;
    if(milestone)events.push({date,kind,title});
    if(hasStats||hasPower)ledger.push({date,createdAt:event.createdAt||event.at||'',kind:'event',event,title});
  }
  let priorSource=null;
  for(const record of ordered(ledger)){
    if(record.kind==='workout'){
      const workout=record.workout;
      for(const key of STATS)running[key]+=n(workout.receipt.stats?.[key]);
      priorSource=workout.receipt.snapshot?.source||null;
      const power=powerAt(running,character,priorSource);
      points.push({date:record.date,workoutDate:workout.date,stats:copyStats(running),base:power.base,power:power.effective,source:`${workout.name||'Training'}${record.date!==workout.date?` · training from ${workout.date}, credited after migration`:''}`,workoutId:workout.id});
    }else{
      const event=record.event;
      for(const key of STATS)running[key]+=n(event.reward?.stats?.[key]);
      const power=powerAt(running,character,event.snapshot?.source||priorSource);
      points.push({date:record.date,stats:copyStats(running),base:power.base,power:finite(eventPower(event))?Number(eventPower(event)):power.effective,source:record.title,eventId:event.id||`event-${points.length}`});
      if(finite(eventPower(event))&&!event.snapshot?.source)priorSource=null;
    }
  }
  const current=getPower(character),missingStatHistory=!sameStats(running,character.stats);
  points.push({date:today,stats:copyStats(character.stats),base:current.base,power:current.effective,source:missingStatHistory?'Current totals · earlier stat changes lack dated records':'Current recorded totals',current:true,boundary:missingStatHistory});
  return {points:ordered(points),events:ordered(events),undatedEvents,hasLegacy:!!old,hasLegacyHistory,migrationDate:old?startDate:null,missingStatHistory};
}

export function periodBounds(range='30', start='', end='', today=localDate()) {
  today=datePart(today)||localDate();
  if(range==='custom'){const from=datePart(start)||'1970-01-01',to=datePart(end)||today;return from<=to?{start:from,end:to}:{start:to,end:from};}
  if(range==='all') return {start:'1970-01-01',end:today};
  const aliases={year:365,month:30,week:7},requested=aliases[range]??(finite(range)?Number(range):30),days=Math.min(36525,Math.max(1,Math.floor(requested)));
  const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-days+1);
  return {start:d.toISOString().slice(0,10),end:today};
}
export function selectTimeline(timeline,{range='30',start='',end='',group='day',today=localDate()}={}) {
  const bounds=periodBounds(range,start,end,today), rows=new Map();
  const points=ordered((timeline.points||[]).filter(p=>datePart(p.date)));
  const previous=points.filter(p=>p.date<bounds.start).at(-1);
  // The baseline is explicitly an earlier observation; it is not fabricated on the range boundary.
  const candidates=[...(previous?[{...previous,reference:true}]:[]),...points.filter(p=>p.date>=bounds.start&&p.date<=bounds.end)];
  for(const point of candidates){
    let key=point.date;
    if(group==='month')key=point.date.slice(0,7);
    if(group==='week')key=monday(point.date);
    if(point.legacy)key=`legacy-${key}`;
    if(point.reference)key=`reference-${key}`;
    if(point.baseline)key=`baseline-${key}`;
    if(point.boundary)key=`boundary-${key}`;
    if(point.eventId)key=`event-${point.eventId}`;
    rows.set(key,point);
  }
  return {...bounds,points:ordered([...rows.values()]),events:(timeline.events||[]).filter(e=>e.date>=bounds.start&&e.date<=bounds.end)};
}
export function statChanges(character,range='30',today=localDate(),state={}) {
  const bounds=periodBounds(range,'','',today), all=character.workouts || [];
  const migrationDate=legacyCharacter(state,character)?datePart(state.migration?.migratedAt):null;
  const valid=all.filter(w=>!w.legacy&&w.receipt&&datePart(w.date)&&creditDate(w,migrationDate)<=bounds.end),workouts=valid.filter(w=>creditDate(w,migrationDate)>=bounds.start);
  const rewards=(character.journal||[]).filter(event=>activeEvent(event)&&eventDate(event)>=bounds.start&&eventDate(event)<=bounds.end);
  const latest=ordered(valid.filter(w=>w.kind!=='rest')).at(-1);
  return {period:Object.fromEntries(STATS.map(s=>[s,workouts.reduce((v,w)=>v+n(w.receipt.stats?.[s]),0)+rewards.reduce((v,event)=>v+n(event.reward?.stats?.[s]),0)])),latest:copyStats(latest?.receipt?.stats),latestWorkout:latest};
}
export function nextStatBenchmark(value) { const v=Math.max(0,n(value));const magnitude=10**Math.floor(Math.log10(Math.max(1,v)));return [1,2.5,5,10,25,50,100].map(x=>x*magnitude).find(x=>x>v)||magnitude*100; }

export function trainingAnalysis(character,{start='1970-01-01',end=localDate()}={}) {
  ({start,end}=periodBounds('custom',start,end));
  const exerciseMap=new Map(CATALOG.exercises.map(e=>[e.id,e])),nameMap=new Map(CATALOG.exercises.map(e=>[e.name.toLowerCase(),e])),days=new Map(),groups=new Map(),weeks=new Map(),records=new Map();
  let sessions=0,restDays=0,totalVolume=0,totalMinutes=0,estimatedEffortMinutes=0;
  function keep(name,key,value,unit,date,detail,evidence){const id=`${name}:${key}`;if(finite(value)&&value>0&&(!records.has(id)||value>records.get(id).value))records.set(id,{name,key,value,unit,date,detail,...evidence});}
  for(const workout of ordered((character.workouts||[]).map(getEffectivePhysicalRecord).filter(w=>datePart(w.date)))){
    if(workout.date<start||workout.date>end)continue;
    const day=days.get(workout.date)||{date:workout.date,sessions:0,rest:false,volume:0,minutes:0,groups:new Set(),workouts:[]};day.workouts.push(workout);
    if(workout.kind==='rest'){day.rest=true;days.set(workout.date,day);continue;}
    sessions++;day.sessions++;estimatedEffortMinutes+=positive(workout.receipt?.minutes);
    const groupsInSession=new Set();
    for(const [entryIndex,entry] of (workout.entries||[]).entries()){
      const ex=exerciseMap.get(entry.exerciseId)||nameMap.get(String(entry.name||'').toLowerCase())||entry;
      const name=ex.name||entry.name||entry.exerciseId||'Unclassified exercise',group=ex.group||entry.muscle||entry.subcategory||ex.category||'Unclassified';groupsInSession.add(group);day.groups.add(group);
      const type=ex.type||entry.type,sets=Array.isArray(entry.sets)&&entry.sets.length?entry.sets:entry.inputs?.setsList||[];
      const evidence={workoutId:workout.id,entryIndex,legacy:!!workout.legacy,...(workout.hasPhysicalCorrection?{originalDate:workout.originalDate,physicalCorrection:workout.physicalCorrection}: {})};
      let volume=0,minutes=0,validSets=0;
      if(['weighted','bodyweight','timed_hold'].includes(type))for(const [setIndex,set] of sets.entries()){
        if(set.completed===false||set.done===false)continue;
        const reps=n(set.reps),weight=n(set.weight),seconds=positive(set.seconds);
        if(type==='timed_hold'){
          if(seconds>0){validSets++;minutes+=seconds/60;keep(name,'hold',seconds,'sec',workout.date,'Timed hold',{...evidence,setIndex,seconds});}
          continue;
        }
        if(!Number.isInteger(reps)||reps<1||reps>1000||weight<0||set.weight!==undefined&&set.weight!==null&&set.weight!==''&&!finite(set.weight)||type==='weighted'&&(!finite(set.weight)||weight<=0))continue;
        validSets++;volume+=reps*weight;
        const paired={...evidence,setIndex,reps,weight};
        keep(name,'weight',weight,'kg',workout.date,`${reps} reps`,paired);keep(name,'reps',reps,'reps',workout.date,`${weight} kg`,paired);
        if(type==='weighted'&&reps<=10)keep(name,'e1rm',reps===1?weight:weight*(1+reps/30),'kg est. 1RM',workout.date,`${weight} kg × ${reps} reps · ${reps===1?'recorded single':'Epley estimate'}`,paired);
      }
      if(['weighted','bodyweight'].includes(type))keep(name,'volume',volume,'kg·reps',workout.date,`${validSets} completed sets`,evidence);
      if(['cardio_distance','cardio_duration'].includes(type)){
        minutes=positive(entry.duration??entry.inputs?.duration??entry.inputs?.durationMinutes);
        keep(name,'duration',minutes,'min',workout.date,'Recorded duration',evidence);
        if(type==='cardio_distance')keep(name,'distance',positive(entry.distance??entry.inputs?.distance??entry.inputs?.distanceKm),'km',workout.date,`${minutes} recorded minutes`,evidence);
      }
      day.volume+=volume;day.minutes+=minutes;
      const item=groups.get(group)||{group,sessions:0,sets:0,volume:0,minutes:0};item.sets+=validSets;item.volume+=volume;item.minutes+=minutes;groups.set(group,item);
    }
    for(const group of groupsInSession)groups.get(group).sessions++;
    days.set(workout.date,day);
  }
  for(const day of days.values()){
    if(day.rest)restDays++;totalVolume+=day.volume;totalMinutes+=day.minutes;
    const key=monday(day.date),week=weeks.get(key)||{date:key,sessions:0,volume:0,minutes:0};week.sessions+=day.sessions;week.volume+=day.volume;week.minutes+=day.minutes;weeks.set(key,week);
  }
  return {sessions,restDays,trainingDays:[...days.values()].filter(d=>d.sessions).length,totalVolume,totalMinutes,estimatedEffortMinutes,days:[...days.values()].map(d=>({...d,groups:[...d.groups]})).sort((a,b)=>a.date.localeCompare(b.date)),groups:[...groups.values()].sort((a,b)=>b.sessions-a.sessions),weeks:[...weeks.values()].sort((a,b)=>a.date.localeCompare(b.date)),records:[...records.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.key.localeCompare(b.key))};
}

export function historyExport(character,period={}) {
  const {start,end}=periodBounds('custom',period.start||'1970-01-01',period.end||localDate());
  const selected=(character.workouts||[]).filter(w=>{const effective=getEffectivePhysicalRecord(w);return datePart(effective.date)&&effective.date>=start&&effective.date<=end;});
  return {format:'dbz-training-history',version:1,character:character.name,routeId:character.routeId,start,end,exportedAt:new Date().toISOString(),baseline:structuredClone(character.baseline||{}),statsAtExport:copyStats(character.stats),workouts:structuredClone(selected),physicalRecords:structuredClone(selected.map(getEffectivePhysicalRecord)),physicalRecordNote:'Date filters and physical analytics use the latest corrected record. Workouts retain the original archive and complete correction chain; receipts and character gains remain unchanged.',journal:structuredClone((character.journal||[]).filter(event=>activeEvent(event)&&eventDate(event)>=start&&eventDate(event)<=end)),bodyWeightLog:structuredClone((character.bodyWeightLog||[]).filter(row=>datePart(row.date)&&row.date>=start&&row.date<=end))};
}
