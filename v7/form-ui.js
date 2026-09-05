import * as E from './engine.js';
import { escapeHTML as esc, number as num } from './ui-kit.js';

export function renderTierPower(tier) {
  return `<div class="tier-power">${tier.signatureForms?.length?`<div class="tier-named-forms"><p class="eyebrow">Named forms</p>${tier.signatureForms.map(form=>`<div class="tier-form-power"><span>${esc(form.name)}</span><b>×${num(form.multiplier)}</b><small>${form.unlocked?'Unlocked':form.canUnlock?'Available to unlock':'Not unlocked'}</small></div>`).join('')}</div>`:''}<p class="tier-route-potential"><span>${tier.earned?'Earned route potential':'Route potential when earned'}</span><b>×${num(tier.multiplier)}</b></p></div>`;
}

export function renderFormCombat(c,formId=c.activeForm,{compact=false}={}) {
  const combat=E.getFormCombat(c,formId);
  if(!combat)return '';
  const base=E.getPower(c).base,percent=factor=>num(factor*100,0);
  const composition=combat.composition?`Super Saiyan Blue ×${num(combat.powerMultiplier/combat.composition.factor)} × Kaioken ${num(combat.composition.factor)} = ×${num(combat.powerMultiplier)}`:'';
  const costs=[['Speed / AGI',combat.speed],['Endurance / stamina',combat.stamina],['Health reserve / VIT',combat.health]].filter(([,factor])=>factor<1);
  const costText=costs.map(([label,factor])=>`${label} −${percent(1-factor)}%`).join(' · ');
  if(compact)return `<div class="form-combat-summary">${composition?`<p class="fine-print">${esc(composition)}</p>`:''}${costs.length?`<p class="form-strain">${esc(costText)}</p><p class="fine-print">Temporary combat capacity · sustained estimate ×${num(combat.sustainedMultiplier,2)}</p>`:''}</div>`;
  return `<section class="form-combat"><h3>Power & combat capacity</h3><p><strong>${num(base,2)} base PL × ${num(combat.powerMultiplier)} = ${num(base*combat.powerMultiplier,2)} burst PL</strong></p>${composition?`<p>${esc(composition)}</p>`:''}${costs.length?`<p class="form-strain">${esc(costText)}</p><div class="r-detail-metrics"><section><span>Speed</span><strong>${percent(combat.speed)}%</strong></section><section><span>Endurance / stamina</span><strong>${percent(combat.stamina)}%</strong></section><section><span>Health reserve</span><strong>${percent(combat.health)}%</strong></section></div><p><strong>Sustained combat estimate: ${num(base*combat.sustainedMultiplier,2)} PL</strong></p><p class="fine-print">Burst PL × ∛(speed × stamina × health reserve) = burst PL × ${num(combat.sustainFactor,4)}. The higher raw output comes with less capacity for a prolonged fight.</p><div class="table-scroll"><table><thead><tr><th>Stat</th><th>Permanent</th><th>Combat capacity</th></tr></thead><tbody>${[['AGI','Agility'],['END','Endurance'],['VIT','Vitality']].map(([stat,label])=>`<tr><th>${label}</th><td>${num(c.stats[stat],3)}</td><td>${num(combat.temporaryStats[stat],3)}</td></tr>`).join('')}</tbody></table></div><p class="fine-print">${esc(combat.note)} Changing form immediately restores the relevant capacity. This is a character combat estimate; there is no health debt or exercise penalty.</p>`:'<p class="fine-print">This form has no additional combat-capacity penalty under the current form rules.</p>'}</section>`;
}
