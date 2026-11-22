// Porto Verde - City Builder (Procedural 9x9 grid, buildings, roads, beach, pier, colliders)
import { CONFIG } from './config.js';

// Generate dynamic window texture using canvas
function createWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#222233';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#ffaa33'; // lit windows
  for (let x = 12; x < 120; x += 24) {
    for (let y = 16; y < 112; y += 32) {
      if ((x + y) % 5 !== 0) {
        ctx.fillRect(x, y, 10, 18);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const roads = [];
  const intersections = [];

  const totalPitch = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;
  const halfWorld = (CONFIG.GRID_SIZE * totalPitch) / 2;

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(600, 600);
  const groundMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.ground,
    roughness: 0.9,
    metalness: 0.1
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // South beach & water
  const beachGeo = new THREE.PlaneGeometry(600, 80);
  const beachMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.sand, roughness: 0.9 });
  const beach = new THREE.Mesh(beachGeo, beachMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.01, halfWorld + 40);
  beach.receiveShadow = true;
  scene.add(beach);

  const waterGeo = new THREE.PlaneGeometry(800, 400);
  const waterMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.water, roughness: 0.1, metalness: 0.8 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.2, halfWorld + 220);
  scene.add(water);

  // Wooden Pier
  const pierGeo = new THREE.BoxGeometry(8, 0.4, 120);
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
  const pier = new THREE.Mesh(pierGeo, pierMat);
  pier.position.set(0, 0.2, halfWorld + 50);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);

  // Road strips & Sidewalks
  const roadMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.road, roughness: 0.8 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.sidewalk, roughness: 0.8 });

  // Shared building materials & geometries cache
  const windowTex = createWindowTexture();
  windowTex.repeat.set(2, 6);
  const buildingMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.buildingBase,
    roughness: 0.5,
    metalness: 0.2,
    map: windowTex
  });

  const sharedBuildingGeos = {};

  for (let k = -4; k <= 4; k++) {
    for (let m = -4; m <= 4; m++) {
      intersections.push({
        x: k * totalPitch + CONFIG.BLOCK_SIZE / 2 + CONFIG.ROAD_WIDTH / 2,
        z: m * totalPitch + CONFIG.BLOCK_SIZE / 2 + CONFIG.ROAD_WIDTH / 2
      });
    }
  }

  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      const cx = gx * totalPitch;
      const cz = gz * totalPitch;

      // Road grid segments (East-West)
      const roadGeoX = new THREE.PlaneGeometry(totalPitch, CONFIG.ROAD_WIDTH);
      const roadX = new THREE.Mesh(roadGeoX, roadMat);
      roadX.rotation.x = -Math.PI / 2;
      roadX.position.set(cx, 0.01, cz + CONFIG.BLOCK_SIZE / 2 + CONFIG.ROAD_WIDTH / 2);
      roadX.receiveShadow = true;
      scene.add(roadX);
      roads.push({ x: cx, z: cz + CONFIG.BLOCK_SIZE / 2 + CONFIG.ROAD_WIDTH / 2, width: totalPitch, height: CONFIG.ROAD_WIDTH });

      // Road grid segments (North-South)
      const roadGeoZ = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, totalPitch);
      const roadZ = new THREE.Mesh(roadGeoZ, roadMat);
      roadZ.rotation.x = -Math.PI / 2;
      roadZ.position.set(cx + CONFIG.BLOCK_SIZE / 2 + CONFIG.ROAD_WIDTH / 2, 0.01, cz);
      roadZ.receiveShadow = true;
      scene.add(roadZ);
      roads.push({ x: cx + CONFIG.BLOCK_SIZE / 2 + CONFIG.ROAD_WIDTH / 2, z: cz, width: CONFIG.ROAD_WIDTH, height: totalPitch });

      // Sidewalk surrounding block
      const swWidth = CONFIG.BLOCK_SIZE + CONFIG.SIDEWALK_WIDTH * 2;
      const swGeo = new THREE.BoxGeometry(swWidth, 0.2, swWidth);
      const sw = new THREE.Mesh(swGeo, sidewalkMat);
      sw.position.set(cx, 0.1, cz);
      sw.receiveShadow = true;
      scene.add(sw);

      // Buildings inside block
      const bWidth = CONFIG.BLOCK_SIZE - 6;
      const bDepth = CONFIG.BLOCK_SIZE - 6;
      const bHeight = rng.range(18, 55);

      const key = `${Math.round(bWidth)}_${Math.round(bHeight)}_${Math.round(bDepth)}`;
      if (!sharedBuildingGeos[key]) {
        sharedBuildingGeos[key] = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      }

      const building = new THREE.Mesh(sharedBuildingGeos[key], buildingMat);
      building.position.set(cx, bHeight / 2, cz);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);

      // Add AABB collider for player/vehicles
      colliders.push({
        minX: cx - bWidth / 2,
        maxX: cx + bWidth / 2,
        minZ: cz - bDepth / 2,
        maxZ: cz + bDepth / 2
      });

      // Street furniture (palm trees, streetlights, benches on sidewalks)
      if (rng.next() > 0.4) {
        const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 4, 6);
        const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
        const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
        trunk.position.set(cx - bWidth / 2 - 2, 2, cz - bDepth / 2 - 2);
        trunk.castShadow = true;
        scene.add(trunk);

        const leavesGeo = new THREE.SphereGeometry(2.0, 6, 6);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.set(cx - bWidth / 2 - 2, 4.5, cz - bDepth / 2 - 2);
        leaves.castShadow = true;
        scene.add(leaves);
      }
    }
  }

  return { colliders, roads, intersections };
}
