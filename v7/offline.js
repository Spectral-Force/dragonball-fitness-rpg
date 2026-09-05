import { CATALOG } from './catalog.js';
import * as ART from './art.js';
export const ART_CACHE='dbz-v7-art-v1';

/** Include semantic assignments, responsive variants and the preserved legacy library. */
export function getArtworkPaths() {
  const rows = [...Object.keys(CATALOG.assets), ...Object.values(ART.FORM_ART || {}), ...Object.values(ART.EQUIPMENT_ART || {}),
    ...Object.values(ART.ABILITY_ART || {}).flatMap(value => [value.art, value.mobile, value.mobileArt]),
    ...(ART.ART_ASSETS || []).flatMap(value => typeof value === 'string' ? [value] : [value.path, value.mobile]),
    ...CATALOG.partners.map(partner => partner.image),
    ...['mountain-dawn','turtle-sanctuary','awakening',...Object.keys(CATALOG.routes).map(route => `portrait-${route}`)].flatMap(name => [`images/v7/${name}.webp`,`images/v7/${name}-mobile.webp`])];
  const known = new Map(Object.keys(CATALOG.assets).map(path => [path.toLowerCase(), path]));
  const paths = rows.filter(path => typeof path === 'string').map(path => {
    let raw = path.replace(/^\.\//, '');
    try { raw = decodeURI(raw); } catch { /* Literal percent symbols are valid file names. */ }
    return known.get(raw.toLowerCase()) || raw;
  }).filter(path => /^images\//.test(path) && /\.(?:webp|png|jpe?g|svg)$/i.test(path));
  // All new collection key art is delivered in desktop and mobile WebP variants.
  const responsive = paths.filter(path => /^images\/v7\/(?:form|tech)-.*(?<!-mobile)\.webp$/.test(path)).map(path => path.replace(/\.webp$/, '-mobile.webp'));
  return [...new Set([...paths, ...responsive])].sort();
}

/** Optional full illustration pack. The install shell already includes the story and player art. */
export async function cacheArtwork({onProgress=()=>{},signal}={}) {
  if(!globalThis.caches)throw new Error('Offline artwork needs localhost or an HTTPS installation.');
  const paths=getArtworkPaths();
  const cache=await caches.open(ART_CACHE);
  let index=0,completed=0,downloaded=0;
  const failures=[];
  onProgress({completed,total:paths.length,downloaded,failed:0});
  async function worker(){
    while(index<paths.length){
      if(signal?.aborted)throw new DOMException('Artwork download cancelled. Completed images remain available.','AbortError');
      const path=paths[index++];
      const url=new URL(path.split('/').map(encodeURIComponent).join('/'),document.baseURI).href;
      try{
        if(!await cache.match(url)){
          const response=await fetch(url,{signal,cache:'reload'});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          await cache.put(url,response);downloaded++;
        }
      }catch(error){if(signal?.aborted)throw error;failures.push(path);}
      completed++;onProgress({completed,total:paths.length,downloaded,failed:failures.length});
    }
  }
  await Promise.all(Array.from({length:4},worker));
  return {completed,total:paths.length,downloaded,failures};
}
