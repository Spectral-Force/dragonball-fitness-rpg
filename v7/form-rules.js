// Explicit v7 game rules. Catalog generation and runtime share these values.
// Combat costs describe temporary character capacity, never earned training stats.
export const FORM_POWER_RULES_VERSION = 2;
export const FORM_POWER_OVERRIDES = Object.freeze({
  kaioken_x1:2, kaioken_x3:3, kaioken_x10:10, kaioken_x20:20,
  kaioken_x50:50, kaioken_x100:100, false_ss:5, ascended_ss:55,
  mastered_ss:60, ultra_ss:65, golden_great_ape:500,
});
export const FORM_COMBAT_COSTS = Object.freeze({
  ultra_ss:Object.freeze({speed:.55,stamina:.55,health:1}),
  ssb_kaioken_x10:Object.freeze({speed:1,stamina:.75,health:.85}),
  ssb_kaioken_x20:Object.freeze({speed:1,stamina:.55,health:.70}),
});
const normal = Object.freeze({speed:1,stamina:1,health:1});
export const formCombatCosts = formId => FORM_COMBAT_COSTS[formId] || normal;

export function applyFormPowerRules(transformations) {
  const blue=transformations.find(form=>form.id==='super_saiyan_blue');
  if (!blue || !(Number(blue.powerMultiplier || blue.mult)>0)) throw new Error('Super Saiyan Blue needs an explicit power multiplier.');
  const bluePower=Number(blue.powerMultiplier || blue.mult);
  return transformations.map(form=>{
    const factor=form.id==='ssb_kaioken_x10'?10:form.id==='ssb_kaioken_x20'?20:null;
    const powerMultiplier=factor?bluePower*factor:FORM_POWER_OVERRIDES[form.id]??Number(form.powerMultiplier || form.mult || 1);
    const updated={...form,powerMultiplier,mult:powerMultiplier};
    if(form.id==='kaioken_x1')updated.name='Kaioken ×2'; // Stable save/art ID is intentionally preserved.
    if(form.id==='false_ss')updated.statProfile={...form.statProfile,note:'An incomplete Super Saiyan awakening with five times base power.'};
    if(FORM_COMBAT_COSTS[form.id])updated.combatCosts={...FORM_COMBAT_COSTS[form.id]};
    if(factor)updated.powerComposition={baseFormId:blue.id,factor};
    return updated;
  });
}
