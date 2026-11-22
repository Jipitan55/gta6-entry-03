// Pedestrians module: creation, stroll, flee, collision and hit testing
import { CONFIG } from './config.js';

let sharedPedBodyGeo = null;
let sharedHeadGeo = null;
let sharedHeadMat = null;

function initPedAssets() {
  if (!sharedPedBodyGeo) {
    sharedPedBodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 6);
    sharedHeadGeo = new THREE.SphereGeometry(0.2, 6, 6);
    sharedHeadMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
  }
}

let activePedestrians = [];

export function createPedestrians(scene, rng, count = 20) {
  initPedAssets();
  activePedestrians = [];
  const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;

  for (let i = 0; i < count; i++) {
    const gx = rng.int(-3, 3);
    const gz = rng.int(-3, 3);
    const cx = gx * totalPitch;
    const cz = gz * totalPitch;

    // Place on sidewalk edge around block
    const side = rng.int(0, 3);
    let x = cx, z = cz;
    const offset = CONFIG.BLOCK_SIZE / 2 + 2;
    if (side === 0) { x = cx + offset; z = cz + rng.range(-20, 20); }
    else if (side === 1) { x = cx - offset; z = cz + rng.range(-20, 20); }
    else if (side === 2) { x = cx + rng.range(-20, 20); z = cz + offset; }
    else { x = cx + rng.range(-20, 20); z = cz - offset; }

    const shirtColor = rng.choice([0x3366cc, 0xcc3333, 0x33cc33, 0xcccc33, 0xcc33cc, 0x33cccc, 0xffffff]);
    const mat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const group = new THREE.Group();

    const body = new THREE.Mesh(sharedPedBodyGeo, mat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(sharedHeadGeo, sharedHeadMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    group.position.set(x, 0, z);
    scene.add(group);

    activePedestrians.push({
      mesh: group,
      pos: group.position,
      angle: rng.range(0, Math.PI * 2),
      speed: 1.2,
      state: 'walk', // 'walk' | 'flee' | 'idle' | 'down'
      health: 100,
      timer: rng.range(0, 5),
      fleeTimer: 0,
      radius: 0.5
    });
  }

  return activePedestrians;
}

export function updatePedestrians(dt, state, dangers) {
  const playerPos = state.player.pos;

  for (const ped of activePedestrians) {
    if (ped.state === 'down') {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        ped.health = 100;
      }
      continue;
    }

    // Check danger (player car speeding nearby, gunshot, police chase)
    let threatPos = null;
    let maxDangerDist = 8.0;

    if (!state.player.onFoot && state.player.car) {
      const car = state.player.car;
      const dist = ped.pos.distanceTo(car.pos);
      if (dist < 10.0 && Math.abs(car.speed) > 4.0) {
        threatPos = car.pos;
        maxDangerDist = 12.0;
      }
    }

    if (dangers) {
      for (const d of dangers) {
        const dist = ped.pos.distanceTo(d);
        if (dist < 12.0) {
          threatPos = d;
          maxDangerDist = 15.0;
        }
      }
    }

    if (threatPos && ped.pos.distanceTo(threatPos) < maxDangerDist) {
      ped.state = 'flee';
      ped.fleeTimer = 4.0;
      const angleToThreat = Math.atan2(ped.pos.x - threatPos.x, ped.pos.z - threatPos.z);
      ped.angle = angleToThreat + state.rng.range(-0.5, 0.5);
      ped.speed = 4.2;
    } else if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.speed = 1.2;
      }
    } else {
      // Normal walk / idle
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.timer = state.rng.range(3, 8);
        if (state.rng.next() > 0.6) {
          ped.state = 'idle';
        } else {
          ped.state = 'walk';
          ped.angle += state.rng.range(-1.5, 1.5);
          ped.speed = 1.2;
        }
      }
    }

    if (ped.state === 'walk' || ped.state === 'flee') {
      const nextX = ped.pos.x + Math.sin(ped.angle) * ped.speed * dt;
      const nextZ = ped.pos.z + Math.cos(ped.angle) * ped.speed * dt;

      // Keep peds out of buildings (simple box check)
      let inBuilding = false;
      const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;
      const bx = Math.round(nextX / totalPitch) * totalPitch;
      const bz = Math.round(nextZ / totalPitch) * totalPitch;
      const bWidth = CONFIG.BLOCK_SIZE - 6;

      if (
        nextX > bx - bWidth / 2 && nextX < bx + bWidth / 2 &&
        nextZ > bz - bWidth / 2 && nextZ < bz + bWidth / 2
      ) {
        inBuilding = true;
      }

      if (inBuilding) {
        ped.angle += Math.PI / 2;
      } else {
        ped.pos.x = nextX;
        ped.pos.z = nextZ;
      }
    }

    ped.mesh.position.copy(ped.pos);
    ped.mesh.rotation.y = ped.angle;
    if (ped.state === 'down') {
      ped.mesh.rotation.z = Math.PI / 2;
    } else {
      ped.mesh.rotation.z = 0;
    }
  }
}

export function pedHitTest(pos, radius = 1.5) {
  for (const ped of activePedestrians) {
    if (ped.state !== 'down' && ped.pos.distanceTo(pos) < radius) {
      ped.state = 'down';
      ped.timer = 5.0; // recovery time
      return ped;
    }
  }
  return null;
}

export function getPedestrians() {
  return activePedestrians;
}
