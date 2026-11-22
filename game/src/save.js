// Save / Load game state using localStorage with try/catch guard
import { CONFIG } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.player.cash,
      missionIndex: state.mission.index,
      health: state.player.health,
      playerPos: [state.player.pos.x, state.player.pos.y, state.player.pos.z]
    };
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.SAVE_KEY);
  } catch (e) {}
}
