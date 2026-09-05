import { createState } from './engine.js';
import { planForCharacter } from './planner.js';

// Work on detached candidates; the UI adopts them only after a verified save.
export function deleteCharacter(state, characterId) {
  if (!Object.hasOwn(state.characters, characterId)) throw new Error('This character is no longer available. Reopen your character list.');
  const next = structuredClone(state);
  delete next.characters[characterId];
  if (!Object.hasOwn(next.characters, next.activeCharacterId)) next.activeCharacterId = Object.keys(next.characters)[0] || null;
  return next;
}

export function startFresh(state, { keepTrainingSetup = true } = {}) {
  const next = createState();
  // Keep the concurrency token so reset cannot overwrite another tab's progress.
  next.revision = state.revision;
  next.savedAt = state.savedAt;
  next.settings.motion = state.settings?.motion !== false;
  next.settings.sound = state.settings?.sound === true;
  if (keepTrainingSetup) {
    next.templates = structuredClone(state.templates || []);
    const active = state.characters[state.activeCharacterId] || Object.values(state.characters)[0];
    next.plan = active ? planForCharacter(active, state) : structuredClone(state.plan || {});
  }
  return next;
}
