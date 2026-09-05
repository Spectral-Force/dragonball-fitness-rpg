import { CATALOG } from './catalog.js';
import { SOURCE_ABILITY_ART, SOURCE_FORM_ART } from './source-art.js';
import { GENERATED_EQUIPMENT_ART } from './equipment-art.js';

const known = new Map(Object.keys(CATALOG.assets).map(path => [path.toLowerCase(), path]));
const t = name => `images/transformations/${name}.webp`;
const p = name => `images/partners/${name}.webp`;
const exact = path => known.get(path.toLowerCase()) || path;
export const PARTNER_ART = Object.freeze(Object.fromEntries(CATALOG.partners.map(partner => [partner.id, exact(String(partner.image || p(partner.id)).replace(/^\.\//, ''))])));
// Reviewed originals, identity corrections and the user's retained form choices.
export const FORM_ART = Object.freeze(Object.fromEntries(CATALOG.transformations.map(form=>{
  const source=SOURCE_FORM_ART[form.id];
  if(!source)throw Error(`Missing reviewed form artwork: ${form.id}`);
  return [form.id,source.art];
})));
export const EQUIPMENT_ART = Object.freeze({weighted:'images/training_branches/weighted_clothing.webp',gravity:'images/training_branches/gravity_machine.webp',chamber:'images/training_branches/hyperbolic_time_chamber.webp',otherworld:'images/training_branches/other_world_training.webp'});
export const EQUIPMENT_ITEM_ART = Object.freeze(Object.fromEntries(CATALOG.trainingBranches.flatMap(branch => branch.upgrades.map(upgrade => {
  const art=GENERATED_EQUIPMENT_ART[upgrade.id];
  if(!art)throw Error(`Missing individual equipment artwork: ${upgrade.id}`);
  return [upgrade.id,Object.freeze({...art,name:upgrade.name,branch:branch.id,shared:false})];
}))));
export const DRAGON_BALL_ART = Object.freeze(Object.fromEntries(['earth','namek','super'].map(set => [set,Object.freeze(Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,`images/dragon_balls/${set}_dragon_ball_${i+1}.webp`])))])));
export const SAGA_ART = Object.freeze(Object.fromEntries(CATALOG.sagas.map(saga=>[saga.id,exact(`images/saga_banners/${saga.id}.webp`)])));
export const TECHNIQUE_FAMILIES = Object.freeze({
  ki:{name:'Ki control',art:'images/v7/tech-ki.webp',colour:'#59d6ff',glyph:'✦'},
  turtle:{name:'Turtle School',art:'images/v7/tech-kamehameha.webp',colour:'#52c9ff',glyph:'波'},
  martial:{name:'Martial technique',art:'images/v7/tech-martial.webp',colour:'#ffaa65',glyph:'拳'},
  movement:{name:'Movement & time',art:'images/v7/tech-movement.webp',colour:'#b995ff',glyph:'瞬'},
  defence:{name:'Defence & restoration',art:'images/v7/tech-defence.webp',colour:'#7ce9b0',glyph:'守'},
  destruction:{name:'Destructive energy',art:'images/v7/tech-destruction.webp',colour:'#ec86ff',glyph:'破'},
  divine:{name:'Divine technique',art:'images/v7/tech-divine.webp',colour:'#ffe091',glyph:'神'},
  spirit:{name:'Spirit technique',art:'images/v7/tech-spirit-bomb.webp',colour:'#a1edff',glyph:'元'},
  flash:{name:'Focused power',art:'images/v7/tech-final-flash.webp',colour:'#ffe16f',glyph:'閃'}
});
// Explicit IDs keep art stable if a move's display name changes.
// These are the 95 catalog IDs, not guessed names or rank variants. Families are
// illustration themes; they do not override a technique's mechanical specialty.
export const ABILITY_FAMILY_IDS = Object.freeze({
 ki:['ki_blast','spirit_ball','hellzone_grenade','light_grenade','scatter_shot','continuous_energy_bullet','full_power_energy_wave','super_ghost_kamikaze','double_sunday','saturday_crash','crusher_ball','milky_cannon','eraser_gun','justice_flash','power_impact','gigantic_burst','daima_spirit_control','demon_realm_burst','punishing_storm'],
 turtle:['kamehameha','final_kamehameha','father_son_kamehameha','solar_kamehameha','god_kamehameha','x10_kamehameha','true_kamehameha','big_bang_kamehameha','beast_roar','bluff_kamehameha'],
 martial:['rock_scissors_paper','janken_rock','wolf_fang_fist','purple_comet_attack','fighting_pose','nova_strike','ruthless_blow','burning_slash','colossal_slash','spirit_sword','savage_strike','dragon_fist'],
 movement:['flight','after_image','multi_form','instant_transmission','time_freeze','vice_shout','temporal_do_over','time_skip'],
 defence:['solar_flare','evil_containment_wave','galactic_donut','body_change','energy_absorption','chocolate_beam'],
 destruction:['destructo_disc','death_beam','death_ball','hakai','ultra_ego_rampage','break_canon','exploding_wave','death_saucer','supernova','barrage_death_beam','self_destruction','human_extinction_attack','revenge_death_ball','god_of_destruction_wrath','sphere_of_destruction','final_explosion','omega_blaster','gigantic_roar','negative_karma_ball','minus_energy_power_ball'],
 divine:['stardust_breaker','silver_dragon_flash','divine_lasso','holy_wrath','stardust_fall','god_split_cut','soul_punisher'],
 spirit:['ki_sense','spirit_bomb'],
 flash:['dodon_ray','masenko','tri_beam','neo_tri_beam','galick_gun','special_beam_cannon','big_bang_attack','final_flash','granolah_sniping','finishing_flash','revenge_cannon']
});
const familyById = new Map();
for (const [family,ids] of Object.entries(ABILITY_FAMILY_IDS)) for (const id of ids) {
  if (familyById.has(id)) throw Error(`Duplicate technique artwork assignment: ${id}`);
  familyById.set(id,family);
}
const catalogAbilityIds = new Set(CATALOG.abilities.map(a=>a.id));
for (const id of familyById.keys()) if (!catalogAbilityIds.has(id)) throw Error(`Artwork refers to an unknown technique: ${id}`);
export const ABILITY_ART = Object.freeze(Object.fromEntries(CATALOG.abilities.map((ability,index)=>{
  const family=familyById.get(ability.id);
  if (!family) throw Error(`Technique needs an explicit artwork assignment: ${ability.id}`);
  const source=SOURCE_ABILITY_ART[ability.id];
  if(!source)throw Error(`Missing reviewed ability artwork: ${ability.id}`);
  const shared=['negative_karma_ball','minus_energy_power_ball'].includes(ability.id);
  return [ability.id,Object.freeze({...TECHNIQUE_FAMILIES[family],...source,name:ability.name,familyName:TECHNIQUE_FAMILIES[family].name,family,number:index+1,signature:ability.id,shared,sharingReason:shared?'The supplied Negative Karma Ball and Minus Energy Power Ball files contain exactly the same image.':null})];
})));
export function imagePath(path) {
  if (typeof path!=='string'||!path) throw Error('An illustration requires an explicit asset path.');
  let raw=path.replace(/^\.\//,'');try{raw=decodeURI(raw);}catch{/* Literal percent characters are valid authored filenames. */}
  return exact(raw).split('/').map(encodeURIComponent).join('/');
}
export function partnerImage(id) { return imagePath(PARTNER_ART[id]); }
export function formImage(id,routeId='saiyan') { return id==='base'?`images/v7/portrait-${routeId}.webp`:imagePath(FORM_ART[id]); }
const responsiveRecords=new Map([...Object.values(SOURCE_ABILITY_ART),...Object.values(SOURCE_FORM_ART),...Object.values(EQUIPMENT_ITEM_ART)].map(record=>[imagePath(record.art),record]));
export function responsiveArtwork(src) {
  const record=responsiveRecords.get(imagePath(src));
  if(record) return {width:record.width,height:record.height,srcset:record.mobile!==record.art&&record.mobileWidth<record.width?`${imagePath(record.mobile)} ${record.mobileWidth}w, ${imagePath(record.art)} ${record.width}w`:''};
  if(/^images\/v7\/(?:form-|tech-)/.test(src))return {srcset:`${src.replace('.webp','-mobile.webp')} 512w, ${src} 1024w`};
  return null;
}
export function auraColour(id) {
  if(/kaioken/.test(id))return '#ff5068';if(/blue/.test(id)||/ssb/.test(id))return '#55d6ff';if(/ego|rose|beast/.test(id))return '#d28aff';if(/instinct/.test(id))return '#d6efff';if(/god/.test(id))return '#ff7382';if(/gold|saiyan|ss/.test(id))return '#ffe070';if(/namek|fusion|orange/.test(id))return '#98e997';return '#6ce1c4';
}

export const ART_ASSETS = Object.freeze([...new Set([...Object.values(SOURCE_ABILITY_ART),...Object.values(SOURCE_FORM_ART),...Object.values(EQUIPMENT_ITEM_ART)].flatMap(r=>[r.art,r.mobile]).concat([...Object.values(PARTNER_ART),...Object.values(EQUIPMENT_ART),...Object.values(DRAGON_BALL_ART).flatMap(Object.values),...Object.values(SAGA_ART),...Object.keys(CATALOG.routes).map(id=>`images/v7/portrait-${id}.webp`)].flatMap(path=>path.startsWith('images/v7/portrait-')?[path,path.replace('.webp','-mobile.webp')]:[path]))) ]);
