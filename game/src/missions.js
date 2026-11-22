// Missions module: 3-mission story chain with 3D beacons and rewards
import { addWanted } from './police.js';

let missionBeacon = null;
let bannerTimer = 0;

const missionsData = [
  {
    title: "M1: First Wheels",
    brief: "Mara Voss needs a driver. Steal a car and drive to her garage at (26, 78).",
    marker: new THREE.Vector3(26, 0, 78),
    reward: 500,
    type: "deliver_car"
  },
  {
    title: "M2: The Bayfront Pickup",
    brief: "Drive to the pier at (0, 234). Press E on foot to grab the package, then deliver to the garage.",
    marker: new THREE.Vector3(0, 0, 234),
    reward: 1200,
    type: "pickup_deliver"
  },
  {
    title: "M3: Harbor Heat",
    brief: "You're hot! Evade the heat and reach the safehouse at (-104, 130).",
    marker: new THREE.Vector3(-104, 0, 130),
    reward: 2500,
    type: "reach_safehouse"
  }
];

export function startMission(state, index, scene) {
  state.mission.index = index;
  if (index >= missionsData.length) {
    state.mode = 'complete';
    state.mission.objective = 'Story Complete! All heists finished.';
    if (missionBeacon) {
      scene.remove(missionBeacon);
      missionBeacon = null;
    }
    return;
  }

  const m = missionsData[index];
  state.mission.objective = m.brief;
  if (m.type === 'pickup_deliver' && state.mission.hasPackage) {
    state.mission.marker = new THREE.Vector3(26, 0, 78);
  } else {
    state.mission.marker = m.marker.clone();
  }

  showMissionBanner(m.title, m.brief);

  if (missionBeacon) {
    scene.remove(missionBeacon);
    missionBeacon = null;
  }

  const beaconGroup = new THREE.Group();
  const cylGeo = new THREE.CylinderGeometry(1.5, 1.5, 20, 12, 1, true);
  const cylMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  const cyl = new THREE.Mesh(cylGeo, cylMat);
  cyl.position.y = 10;
  beaconGroup.add(cyl);

  const diamondGeo = new THREE.OctahedronGeometry(1.2);
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.8 });
  const diamond = new THREE.Mesh(diamondGeo, diamondMat);
  diamond.position.y = 4;
  beaconGroup.add(diamond);

  beaconGroup.position.copy(state.mission.marker);
  scene.add(beaconGroup);
  missionBeacon = beaconGroup;

  if (window.playSound) window.playSound('blip');
}

function showMissionBanner(title, brief) {
  const banner = document.getElementById('mission-banner');
  if (banner) {
    banner.innerHTML = `<div style="font-size:1.2rem; color:#ffaa00; font-weight:bold;">${title}</div><div style="font-size:0.95rem; color:#fff;">${brief}</div>`;
    banner.classList.remove('hidden');
    bannerTimer = 6.0;
  }
}

export function updateMissions(dt, state, scene, input) {
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) {
      const banner = document.getElementById('mission-banner');
      if (banner) banner.classList.add('hidden');
    }
  }

  if (state.mission.index >= missionsData.length || state.mode !== 'play') return;

  const m = missionsData[state.mission.index];
  const pPos = state.player.pos;

  if (missionBeacon) {
    missionBeacon.rotation.y += dt * 2;
  }

  if (m.type === 'deliver_car') {
    if (!state.player.onFoot && state.mission.marker) {
      if (pPos.distanceTo(state.mission.marker) < 6.0) {
        state.player.cash += m.reward;
        startMission(state, state.mission.index + 1, scene);
      }
    }
  } else if (m.type === 'pickup_deliver') {
    if (!state.mission.hasPackage) {
      if (state.player.onFoot && state.mission.marker && pPos.distanceTo(state.mission.marker) < 4.0) {
        state.mission.objective = 'Press E to pick up the contraband package!';
        if (input && input.keys.KeyE) {
          input.keys.KeyE = false;
          state.mission.hasPackage = true;
          addWanted(state, 2);
          state.mission.marker = new THREE.Vector3(26, 0, 78);
          state.mission.objective = 'Package secured! Deliver it to Mara\'s garage at (26, 78).';
          if (window.playSound) window.playSound('blip');
          if (missionBeacon) missionBeacon.position.copy(state.mission.marker);
        }
      }
    } else {
      if (state.mission.marker && pPos.distanceTo(state.mission.marker) < 6.0) {
        state.player.cash += m.reward;
        state.mission.hasPackage = false;
        startMission(state, state.mission.index + 1, scene);
      }
    }
  } else if (m.type === 'reach_safehouse') {
    if (state.mission.index === 2 && state.player.wanted > 0 && state.player.wanted < 3) {
      addWanted(state, 1);
    }
    if (state.mission.marker && pPos.distanceTo(state.mission.marker) < 6.0 && state.player.wanted === 0) {
      state.player.cash += m.reward;
      state.mission.index++;
      state.mode = 'complete';
      if (missionBeacon) {
        scene.remove(missionBeacon);
        missionBeacon = null;
      }
      const endScreen = document.getElementById('end-screen');
      const titleEl = document.getElementById('end-title');
      const subEl = document.getElementById('end-subtitle');
      if (endScreen) endScreen.classList.remove('hidden');
      if (titleEl) titleEl.textContent = 'STORY COMPLETE';
      if (subEl) subEl.textContent = `Sunset Heist successful! Total Cash: $${state.player.cash.toLocaleString()}`;
    } else if (state.mission.marker && pPos.distanceTo(state.mission.marker) < 6.0 && state.player.wanted > 0) {
      state.mission.objective = 'Safehouse reached, but you have WANTED heat! Clear wanted level first!';
    }
  }
}
