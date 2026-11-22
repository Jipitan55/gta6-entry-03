// Vehicles module: car creation, parked cars, traffic AI, physics, enter/exit
import { CONFIG } from './config.js';
import { pedHitTest } from './people.js';
import { raiseWantedForCrime } from './police.js';

let sharedCarBodyGeo = null;
let sharedCabinGeo = null;
let sharedWheelGeo = null;
let sharedWheelMat = null;

function initCarAssets() {
  if (!sharedCarBodyGeo) {
    sharedCarBodyGeo = new THREE.BoxGeometry(2.0, 0.7, 4.2);
    sharedCabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2.2);
    sharedWheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    sharedWheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  }
}

export function createCarMesh(colorHex, isPolice = false) {
  initCarAssets();
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.3,
    metalness: 0.6
  });

  const body = new THREE.Mesh(sharedCarBodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x112233,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.8
  });
  const cabin = new THREE.Mesh(sharedCabinGeo, cabinMat);
  cabin.position.set(0, 1.15, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Wheels
  const wheelPositions = [
    [-1.0, 0.35, 1.3],
    [1.0, 0.35, 1.3],
    [-1.0, 0.35, -1.3],
    [1.0, 0.35, -1.3]
  ];

  for (const pos of wheelPositions) {
    const wheel = new THREE.Mesh(sharedWheelGeo, sharedWheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...pos);
    wheel.castShadow = true;
    group.add(wheel);
  }

  if (isPolice) {
    const lightGeo = new THREE.BoxGeometry(0.8, 0.2, 0.3);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(0, 1.6, 0);
    group.add(light);
  }

  return group;
}

export function spawnParkedCars(scene, rng, count = 10) {
  const cars = [];
  const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;

  for (let i = 0; i < count; i++) {
    let x, z;
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 50) {
      attempts++;
      const gz = rng.int(-4, 4);
      z = gz * totalPitch + 26 + rng.choice([-2, 2]);
      x = rng.range(-200, 200);
      const nearestIntX = Math.round((x - 26) / totalPitch) * totalPitch + 26;
      if (Math.abs(x - nearestIntX) >= 10) {
        valid = true;
      }
    }
    const angle = rng.choice([0, Math.PI]);
    const color = rng.choice(CONFIG.COLORS.carColors);

    const mesh = createCarMesh(color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    scene.add(mesh);

    cars.push({
      mesh,
      pos: mesh.position,
      angle,
      speed: 0,
      steer: 0,
      color,
      kind: 'parked',
      radius: 2.2
    });
  }
  return cars;
}

export function spawnTraffic(scene, rng, count = 12, roads = null, intersections = null) {
  const traffic = [];
  const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;

  for (let i = 0; i < count; i++) {
    const isEW = rng.next() > 0.5;
    const k = rng.int(-4, 4);
    let x, z, angle;
    if (isEW) {
      z = k * totalPitch + 26;
      x = rng.range(-200, 200);
      angle = rng.choice([0, Math.PI]);
    } else {
      x = k * totalPitch + 26;
      z = rng.range(-200, 200);
      angle = rng.choice([Math.PI / 2, -Math.PI / 2]);
    }
    const color = rng.choice(CONFIG.COLORS.carColors);

    const mesh = createCarMesh(color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    scene.add(mesh);

    traffic.push({
      mesh,
      pos: mesh.position,
      angle,
      speed: rng.range(6, 12),
      color,
      kind: 'traffic',
      radius: 2.2,
      ai: {
        waitTimer: 0,
        lastIntersection: null
      }
    });
  }
  return traffic;
}

export function updateVehicles(dt, input, playerCar, cars, colliders, isPlayerDriving, state) {
  for (const car of cars) {
    if (car === playerCar && isPlayerDriving) {
      let throttle = 0;
      let turning = 0;

      if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle += 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle -= 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) turning += 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) turning -= 1;

      if (throttle !== 0) {
        car.speed += throttle * CONFIG.CAR_ACCEL * dt;
        car.speed = Math.max(-10, Math.min(CONFIG.CAR_MAX_SPEED, car.speed));
      } else {
        car.speed *= Math.pow(0.5, dt * 3);
      }

      if (Math.abs(car.speed) > 0.5) {
        car.angle += turning * CONFIG.CAR_STEER * (car.speed / CONFIG.CAR_MAX_SPEED) * dt;
      }

      const nextX = car.pos.x + Math.sin(car.angle) * car.speed * dt;
      const nextZ = car.pos.z + Math.cos(car.angle) * car.speed * dt;

      let collide = false;
      if (colliders) {
        for (const box of colliders) {
          if (
            nextX + car.radius > box.minX &&
            nextX - car.radius < box.maxX &&
            nextZ + car.radius > box.minZ &&
            nextZ - car.radius < box.maxZ
          ) {
            collide = true;
            break;
          }
        }
      }

      if (collide) {
        car.speed *= -0.3;
      } else {
        car.pos.x = nextX;
        car.pos.z = nextZ;
      }

      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.angle;

      // Pedestrian hit test when driving
      if (Math.abs(car.speed) > 4.0 && state) {
        const hitPed = pedHitTest(car.pos, 2.2);
        if (hitPed) {
          raiseWantedForCrime(state, 'hit_ped');
        }
      }
    }
  }
}

export function updateTraffic(dt, state) {
  const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;
  const playerPos = state.player.pos;
  const intersections = state.intersections || [];

  for (const car of state.cars) {
    if (car.kind === 'traffic') {
      const dist = car.pos.distanceTo(playerPos);
      if (dist > 180.0) {
        const isEW = state.rng.next() > 0.5;
        const k = state.rng.int(-4, 4);
        if (isEW) {
          car.pos.z = k * totalPitch + 26;
          car.pos.x = playerPos.x + state.rng.range(-100, 100);
          car.angle = state.rng.choice([0, Math.PI]);
        } else {
          car.pos.x = k * totalPitch + 26;
          car.pos.z = playerPos.z + state.rng.range(-100, 100);
          car.angle = state.rng.choice([Math.PI / 2, -Math.PI / 2]);
        }
        car.speed = state.rng.range(6, 12);
        car.ai.lastIntersection = null;
      }

      if (car.ai && car.ai.waitTimer > 0) {
        car.ai.waitTimer -= dt;
        car.speed = 0;
        continue;
      }

      car.speed = 10.0;
      car.pos.x += Math.sin(car.angle) * car.speed * dt;
      car.pos.z += Math.cos(car.angle) * car.speed * dt;

      // Road locking to stay on roads at all times
      const cosA = Math.cos(car.angle);
      const sinA = Math.sin(car.angle);
      if (Math.abs(sinA) > Math.abs(cosA)) {
        const nearestZ = Math.round((car.pos.z - 26) / totalPitch) * totalPitch + 26;
        car.pos.z = nearestZ;
      } else {
        const nearestX = Math.round((car.pos.x - 26) / totalPitch) * totalPitch + 26;
        car.pos.x = nearestX;
      }

      if (intersections.length > 0) {
        for (const inter of intersections) {
          const dInt = Math.hypot(car.pos.x - inter.x, car.pos.z - inter.z);
          const intKey = `${inter.x}_${inter.z}`;
          if (dInt < 5.0) {
            if (car.ai.lastIntersection !== intKey) {
              car.ai.lastIntersection = intKey;
              const turn = state.rng.choice([-Math.PI / 2, 0, Math.PI / 2]);
              car.angle += turn;
              while (car.angle > Math.PI) car.angle -= Math.PI * 2;
              while (car.angle < -Math.PI) car.angle += Math.PI * 2;
              car.ai.waitTimer = state.rng.range(0.2, 0.8);
              break;
            }
          } else {
            if (car.ai.lastIntersection === intKey && dInt > 7.0) {
              car.ai.lastIntersection = null;
            }
          }
        }
      }

      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.angle;
    }
  }

  // Car-car collision push-apart
  const allCars = state.cars;
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const c1 = allCars[i];
      const c2 = allCars[j];
      const d = c1.pos.distanceTo(c2.pos);
      const minDist = c1.radius + c2.radius;
      if (d < minDist && d > 0.001) {
        const overlap = (minDist - d) / 2;
        const nx = (c2.pos.x - c1.pos.x) / d;
        const nz = (c2.pos.z - c1.pos.z) / d;
        c1.pos.x -= nx * overlap;
        c1.pos.z -= nz * overlap;
        c2.pos.x += nx * overlap;
        c2.pos.z += nz * overlap;
        c1.mesh.position.copy(c1.pos);
        c2.mesh.position.copy(c2.pos);
      }
    }
  }
}

export function findNearestCar(playerPos, cars, maxDist = 4.0) {
  let nearest = null;
  let minDist = maxDist;
  for (const car of cars) {
    const dist = playerPos.distanceTo(car.pos);
    if (dist < minDist) {
      minDist = dist;
      nearest = car;
    }
  }
  return nearest;
}
