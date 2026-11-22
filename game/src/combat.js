// Combat module: melee punching and firearm hitscan shooting
import { getPedestrians } from './people.js';
import { handleGunshot } from './police.js';

let meleeCooldown = 0;
let shootCooldown = 0;

export function meleeAttack(state) {
  if (meleeCooldown > 0) return;
  meleeCooldown = 0.4;

  const playerPos = state.player.pos;
  const pAngle = state.player.angle || 0;
  const forwardX = Math.sin(pAngle);
  const forwardZ = Math.cos(pAngle);

  const peds = getPedestrians();

  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const dx = ped.pos.x - playerPos.x;
    const dz = ped.pos.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= 2.2) {
      const len = dist > 0.001 ? dist : 1;
      const nx = dx / len;
      const nz = dz / len;
      const dot = nx * forwardX + nz * forwardZ;
      if (dot > 0.5) {
        ped.health = (ped.health || 100) - 25;
        ped.pos.x += forwardX * 1.5;
        ped.pos.z += forwardZ * 1.5;
        if (ped.health <= 0) {
          ped.state = 'down';
          ped.timer = 5.0;
        }
        break;
      }
    }
  }

  if (window.playSound) window.playSound('punch');
}

export function shootWeapon(state, camera) {
  if (shootCooldown > 0 || !state.player.onFoot) return;
  shootCooldown = 0.5;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const playerPos = state.player.pos;
  const peds = getPedestrians();
  let nearestTarget = null;
  let minDist = 40.0;

  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const dist = playerPos.distanceTo(ped.pos);
    if (dist < minDist) {
      const dirToPed = new THREE.Vector3().subVectors(ped.pos, camera.position).normalize();
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const dot = camDir.dot(dirToPed);
      if (dot > 0.94) {
        minDist = dist;
        nearestTarget = { type: 'ped', obj: ped };
      }
    }
  }

  if (state.police) {
    for (const pCar of state.police) {
      if (pCar.disabled) continue;
      const dist = playerPos.distanceTo(pCar.pos);
      if (dist < minDist) {
        const dirToCar = new THREE.Vector3().subVectors(pCar.pos, camera.position).normalize();
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const dot = camDir.dot(dirToCar);
        if (dot > 0.94) {
          minDist = dist;
          nearestTarget = { type: 'police', obj: pCar };
        }
      }
    }
  }

  handleGunshot(state, playerPos);
  if (!state.dangers) state.dangers = [];
  state.dangers.push({ pos: playerPos.clone(), ttl: 6.0 });

  if (nearestTarget) {
    if (nearestTarget.type === 'ped') {
      const ped = nearestTarget.obj;
      ped.health = (ped.health || 100) - 34;
      if (ped.health <= 0) {
        ped.state = 'down';
        ped.timer = 5.0;
      }
    } else if (nearestTarget.type === 'police') {
      const pCar = nearestTarget.obj;
      pCar.health = (pCar.health || 100) - 34;
      if (pCar.health <= 0) {
        pCar.speed = 0;
        pCar.disabled = true;
        const lightMesh = pCar.mesh.children[pCar.mesh.children.length - 1];
        if (lightMesh && lightMesh.material) {
          lightMesh.material.color.setHex(0x333333);
        }
      }
    }
  }

  if (window.playSound) window.playSound('gunshot');
}

export function updateCombat(dt, state, camera, scene, input) {
  if (meleeCooldown > 0) meleeCooldown -= dt;
  if (shootCooldown > 0) shootCooldown -= dt;

  if (input.keys.KeyF) {
    input.keys.KeyF = false;
    meleeAttack(state);
  }

  if (input.mouse.click && state.player.onFoot && state.mode === 'play') {
    shootWeapon(state, camera);
  }

  if (state.dangers) {
    for (let i = state.dangers.length - 1; i >= 0; i--) {
      state.dangers[i].ttl -= dt;
      if (state.dangers[i].ttl <= 0) {
        state.dangers.splice(i, 1);
      }
    }
  }
}
