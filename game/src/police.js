// Police and Wanted System module
import { CONFIG } from './config.js';
import { createCarMesh } from './vehicles.js';

let bustedTimer = 0;
let losTimer = 0;

export function getWanted(state) {
  return state.player.wanted || 0;
}

export function addWanted(state, n) {
  const current = state.player.wanted || 0;
  state.player.wanted = Math.max(0, Math.min(5, current + n));
  if (state.player.wanted > 0) {
    losTimer = 0; // reset decay timer on crime/wanted increase
  }
}

export function raiseWantedForCrime(state, kind) {
  if (kind === 'car_steal') {
    addWanted(state, 1);
    state.mission.objective = 'Wanted! You stole a vehicle. Evade the police!';
  } else if (kind === 'hit_ped') {
    addWanted(state, 1);
    state.mission.objective = 'Crime reported! You hit a pedestrian. Evade the police!';
  } else if (kind === 'shot') {
    addWanted(state, 1);
    state.mission.objective = 'Gunshots reported! Police are responding.';
  }
}

export function handleGunshot(state, pos) {
  raiseWantedForCrime(state, 'shot');
  // Return gunshot event for pedestrians to flee
  return pos;
}

export function updatePolice(dt, state, scene) {
  const wanted = getWanted(state);
  const player = state.player;
  const policeCars = state.police || (state.police = []);

  // 1. Adjust police car count to match wanted level (wanted level = target count, up to 5)
  while (policeCars.length < wanted) {
    const color = 0x2244ff;
    const mesh = createCarMesh(color, true);
    // Spawn away from player on a road edge
    const angle = state.rng.range(0, Math.PI * 2);
    const dist = state.rng.range(50, 90);
    const spawnX = player.pos.x + Math.sin(angle) * dist;
    const spawnZ = player.pos.z + Math.cos(angle) * dist;
    mesh.position.set(spawnX, 0, spawnZ);
    scene.add(mesh);

    policeCars.push({
      mesh,
      pos: mesh.position,
      angle: 0,
      speed: 0,
      kind: 'police',
      radius: 2.2,
      lightTimer: 0,
      health: 100,
      disabled: false
    });
  }

  while (policeCars.length > wanted && policeCars.length > 0) {
    const pCar = policeCars.pop();
    scene.remove(pCar.mesh);
  }

  // 2. Update police car pursuit AI
  let anyPoliceHasLOS = false;
  const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;
  const intersections = state.intersections || [];
  const colliders = state.colliders || [];

  for (const pCar of policeCars) {
    if (pCar.disabled) continue;
    pCar.lightTimer += dt * 8;
    // Flashing lights color toggle on roof
    const lightMesh = pCar.mesh.children[pCar.mesh.children.length - 1];
    if (lightMesh && lightMesh.material) {
      lightMesh.material.color.setHex(Math.sin(pCar.lightTimer) > 0 ? 0xff0000 : 0x0000ff);
    }

    const dxToPlayer = player.pos.x - pCar.pos.x;
    const dzToPlayer = player.pos.z - pCar.pos.z;
    const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

    // Determine target (waypoint on road network if dist > 40m, else player)
    let targetX = player.pos.x;
    let targetZ = player.pos.z;

    if (distToPlayer > 40.0 && intersections.length > 0) {
      let nearestInt = intersections[0];
      let minDistSq = Infinity;
      for (const inter of intersections) {
        const dSq = (inter.x - player.pos.x) ** 2 + (inter.z - player.pos.z) ** 2;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          nearestInt = inter;
        }
      }
      targetX = nearestInt.x;
      targetZ = nearestInt.z;
    }

    const dx = targetX - pCar.pos.x;
    const dz = targetZ - pCar.pos.z;
    const targetAngle = Math.atan2(dx, dz);

    // Smooth turn towards target
    let angleDiff = targetAngle - pCar.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    pCar.angle += Math.max(-2.0 * dt, Math.min(2.0 * dt, angleDiff));

    const chaseSpeed = Math.min(CONFIG.CAR_MAX_SPEED * 0.9, 8.0 + wanted * 3.0);
    pCar.speed = chaseSpeed;

    const nextX = pCar.pos.x + Math.sin(pCar.angle) * pCar.speed * dt;
    const nextZ = pCar.pos.z + Math.cos(pCar.angle) * pCar.speed * dt;

    let collide = false;
    if (colliders) {
      for (const box of colliders) {
        if (
          nextX + pCar.radius > box.minX &&
          nextX - pCar.radius < box.maxX &&
          nextZ + pCar.radius > box.minZ &&
          nextZ - pCar.radius < box.maxZ
        ) {
          collide = true;
          break;
        }
      }
    }

    if (collide) {
      pCar.angle += Math.PI / 2;
      pCar.speed = 0;
    } else {
      pCar.pos.x = nextX;
      pCar.pos.z = nextZ;
    }

    pCar.mesh.position.copy(pCar.pos);
    pCar.mesh.rotation.y = pCar.angle;

    // Check RAM / collision with player car or on-foot player
    if (!player.onFoot && player.car) {
      const carDist = pCar.pos.distanceTo(player.car.pos);
      if (carDist < 3.0) {
        player.car.speed *= 0.8; // ram slowdown
        player.health = Math.max(0, player.health - 2 * dt);
      }
    }

    // Line of sight check for wanted decay
    if (distToPlayer < 60.0) {
      anyPoliceHasLOS = true;
    }
  }

  // 3. Wanted level decay if no police LOS
  if (wanted > 0) {
    if (!anyPoliceHasLOS) {
      losTimer += dt;
      if (losTimer > 10.0) {
        // Drop 1 star per 8s
        if ((losTimer - 10.0) % 8.0 < dt) {
          addWanted(state, -1);
          if (getWanted(state) === 0) {
            state.mission.objective = 'Wanted level cleared. You got away!';
            // Clean up all police cars
            while (policeCars.length > 0) {
              const p = policeCars.pop();
              scene.remove(p.mesh);
            }
          }
        }
      }
    } else {
      losTimer = 0;
    }
  }

  // 4. Busted condition check: on foot, police car within 3m, player speed low for 2s
  if (wanted > 0 && player.onFoot) {
    let nearPolice = false;
    for (const pCar of policeCars) {
      if (pCar.pos.distanceTo(player.pos) < 4.0) {
        nearPolice = true;
        break;
      }
    }

    if (nearPolice) {
      bustedTimer += dt;
      if (bustedTimer >= 2.0) {
        // Trigger BUSTED state
        state.mode = 'busted';
        state.player.cash = Math.max(0, Math.floor(state.player.cash * 0.8)); // lose 20% cash
        state.player.wanted = 0;
        // Clean up police
        while (policeCars.length > 0) {
          const p = policeCars.pop();
          scene.remove(p.mesh);
        }
        bustedTimer = 0;
      }
    } else {
      bustedTimer = Math.max(0, bustedTimer - dt * 2);
    }
  } else {
    bustedTimer = 0;
  }
}
