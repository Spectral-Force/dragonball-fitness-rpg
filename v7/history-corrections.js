import { validateWorkout } from './engine.js';

const PHYSICAL_FIELDS=Object.freeze(['date','kind','name','notes','rpe','rir','entries','recovery']);
const copy=value=>JSON.parse(JSON.stringify(value));
const physical=record=>Object.fromEntries(PHYSICAL_FIELDS.filter(key=>record[key]!==undefined).map(key=>[key,copy(record[key])]));
const uid=()=>`legacy-correction-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

/**
 * Read the latest physical interpretation for analytics/editor use. The underlying
 * archive, opening-balance receipt and correction chain are not modified.
 */
export function getEffectivePhysicalRecord(workout) {
  if(!workout||typeof workout!=='object'||Array.isArray(workout))throw new Error('Choose a recorded workout.');
  const corrections=Array.isArray(workout.physicalCorrections)?workout.physicalCorrections:[];
  const latest=corrections.at(-1);
  if(!latest)return {...workout,hasPhysicalCorrection:false,originalDate:workout.date};
  if(!workout.legacy||latest.version!==1||latest.workoutId!==workout.id||!latest.after)throw new Error('This workout has an invalid physical correction.');
  const after=validateWorkout({...latest.after,id:workout.id});
  return {...workout,...after,id:workout.id,legacy:true,receipt:workout.receipt,hasPhysicalCorrection:true,originalDate:workout.date,physicalCorrection:{id:latest.id,sequence:latest.sequence,at:latest.at,reason:latest.reason,description:'Corrected physical record; original v6 gains remain in the opening balance.'}};
}

/**
 * Return a replacement workout and an immutable audit entry. This function does
 * not mutate the character and never invokes earning/rebuilding actions.
 * The caller persists result.workout at the original workout's index.
 */
export function createLegacyCorrection(character,workoutId,patch,reason) {
  const original=character?.workouts?.find(workout=>workout.id===workoutId);
  if(!original)throw new Error('That archived workout was not found.');
  if(original.legacy!==true)throw new Error('Use the normal workout editor for v7 sessions so their recorded rewards reconcile.');
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Provide the physical-record changes.');
  if(Object.keys(patch).some(key=>!PHYSICAL_FIELDS.includes(key)))throw new Error('A legacy correction can change physical-record fields only; its identity, original receipt and rewards are preserved.');
  if(typeof reason!=='string'||!reason.trim()||reason.trim().length>2000)throw new Error('Explain the correction in 1–2,000 characters.');
  const effective=getEffectivePhysicalRecord(original),before=physical(effective);
  const validated=validateWorkout({...before,...copy(patch),id:original.id});
  const after=physical(validated);
  // Validate both sides into the same optional-field defaults where possible so
  // opening the editor and pressing Save does not manufacture a correction.
  let comparableBefore=before;
  try{comparableBefore=physical(validateWorkout({...before,id:original.id}));}catch{/* An unknown legacy movement can be explicitly mapped in this correction. */}
  if(JSON.stringify(comparableBefore)===JSON.stringify(after))throw new Error('There are no physical-record changes to save.');
  const existing=Array.isArray(original.physicalCorrections)?original.physicalCorrections:[];
  const correction={id:uid(),version:1,kind:'legacy-physical-correction',workoutId:original.id,sequence:existing.length+1,at:new Date().toISOString(),reason:reason.trim(),before,after,rewardsChanged:false,rewardAdjustment:{xp:0,tp:0,ap:0,storyXP:0},provenance:'The original archived entry and its receipt remain unchanged. This correction is used for exercise analysis, not to replay old training with the current build.'};
  const workout={...original,physicalCorrections:[...existing,correction]};
  return {workout,correction,effective:getEffectivePhysicalRecord(workout)};
}
