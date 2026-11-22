// On-foot player logic and mesh creation
import { CONFIG } from './config.js';

export function createPlayer(scene) {
  const group = new THREE.Group();

  // Capsule / body representation: cylinder + spheres
  const mat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.playerShirt,
    roughness: 0.7,
    metalness: 0.1
  });
  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Head
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
  const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);

  // Legs / pants
  const pantsMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.playerPants, roughness: 0.9 });
  const legGeo = new THREE.BoxGeometry(0.3, 0.7, 0.3);
  const leg1 = new THREE.Mesh(legGeo, pantsMat);
  leg1.position.set(-0.15, 0.35, 0);
  group.add(leg1);
  const leg2 = new THREE.Mesh(legGeo, pantsMat);
  leg2.position.set(0.15, 0.35, 0);
  group.add(leg2);

  scene.add(group);

  const playerState = {
    mesh: group,
    pos: group.position,
    angle: 0,
    health: 100,
    cash: 500,
    wanted: 0,
    onFoot: true,
    car: null,
    radius: 0.6
  };

  return playerState;
}

export function updatePlayerOnFoot(dt, input, cameraYaw, colliders, player) {
  const speed = input.isDown('ShiftLeft') || input.isDown('ShiftRight') ? CONFIG.PLAYER_RUN_SPEED : CONFIG.PLAYER_SPEED;

  let moveX = 0;
  let moveZ = 0;

  if (input.isDown('KeyW') || input.isDown('ArrowUp')) moveZ -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) moveZ += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) moveX -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) moveX += 1;

  if (moveX !== 0 || moveZ !== 0) {
    const len = Math.hypot(moveX, moveZ);
    moveX /= len;
    moveZ /= len;

    // Align movement with camera yaw
    const rotX = moveX * Math.cos(cameraYaw) - moveZ * Math.sin(cameraYaw);
    const rotZ = moveX * Math.sin(cameraYaw) + moveZ * Math.cos(cameraYaw);

    const nextX = player.pos.x + rotX * speed * dt;
    const nextZ = player.pos.z + rotZ * speed * dt;

    // Simple collision check against building AABBs
    let collide = false;
    if (colliders) {
      for (const box of colliders) {
        if (
          nextX + player.radius > box.minX &&
          nextX - player.radius < box.maxX &&
          nextZ + player.radius > box.minZ &&
          nextZ - player.radius < box.maxZ
        ) {
          collide = true;
          break;
        }
      }
    }

    if (!collide) {
      player.pos.x = nextX;
      player.pos.z = nextZ;
    }

    player.angle = Math.atan2(rotX, rotZ);
  }

  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.angle;
}
