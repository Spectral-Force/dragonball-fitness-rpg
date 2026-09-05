export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number=(value,digits=1)=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:digits});
export const button=(label,action,attrs='',cls='ghost')=>`<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
export const progress=(value,max,label='Progress')=>{const top=Math.max(1,Number(max)||1),v=Math.max(0,Math.min(top,Number(value)||0));return `<div class="meter" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="${top}"><span style="width:${v/top*100}%"></span></div>`;};
export const tag=(label,cls='')=>`<span class="tag ${cls}">${escapeHTML(label)}</span>`;
export const empty=(title,body='')=>`<div class="restored-empty"><strong>${escapeHTML(title)}</strong><p class="muted">${escapeHTML(body)}</p></div>`;
export const shortDate=date=>new Date(`${String(date).slice(0,10)}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short'});
