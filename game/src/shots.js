// Porto Verde - Deterministic Shot Staging for screenshot testing (?shot=start|play|end|mission)
import { createRNG } from './random.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { spawnParkedCars, createCarMesh } from './vehicles.js';
import { createPedestrians } from './people.js';
import { drawMinimap } from './hud.js';

export function stageShot(name, game) {
  const { scene, camera } = game;
  const rng = createRNG(1);

  // Build the city environment deterministically
  buildCity(scene, rng);
  const cars = spawnParkedCars(scene, rng, 12);

  if (name === 'start') {
    camera.position.set(0, 130, 180);
    camera.lookAt(0, 0, 0);

    drawMinimap({
      player: { pos: new THREE.Vector3(0, 0, 26), angle: 0 },
      cars,
      police: [],
      mission: { marker: null },
      time: 0
    });

    return 'start-screen';
  } 
  else if (name === 'play') {
    const player = createPlayer(scene);
    const car = cars[0] || spawnParkedCars(scene, rng, 1)[0];
    player.car = car;
    player.onFoot = false;
    car.mesh.position.set(0, 0, 26);
    car.pos = car.mesh.position;
    car.angle = 0;
    car.mesh.rotation.y = car.angle;

    player.pos.copy(car.pos);
    player.mesh.position.copy(player.pos);
    scene.remove(player.mesh);

    if (cars[1]) {
      cars[1].mesh.position.set(-14, 0, 26);
      cars[1].pos = cars[1].mesh.position;
    }
    if (cars[2]) {
      cars[2].mesh.position.set(16, 0, 26);
      cars[2].pos = cars[2].mesh.position;
    }

    const peds = createPedestrians(scene, rng, 2);
    if (peds[0]) peds[0].pos.set(6, 0, 20);
    if (peds[1]) peds[1].pos.set(-8, 0, 33);

    camera.position.set(0, 11, 4);
    camera.lookAt(0, 1, 30);

    const healthFill = document.getElementById('health-fill');
    const cashVal = document.getElementById('cash-val');
    const wantedStars = document.getElementById('wanted-stars');
    const objectiveText = document.getElementById('objective-text');

    if (healthFill) healthFill.style.width = '100%';
    if (cashVal) cashVal.textContent = '$500';
    if (wantedStars) wantedStars.textContent = '☆☆☆☆☆';
    if (objectiveText) objectiveText.textContent = "First Wheels: steal a car and bring it to Mara's garage.";

    drawMinimap({
      player: { pos: car.pos, angle: car.angle },
      cars: [car, cars[1], cars[2]].filter(Boolean),
      police: [],
      mission: { marker: null },
      time: 0
    });

    return 'hud';
  } 
  else if (name === 'end') {
    const playerCar = createCarMesh(0xff2222);
    playerCar.position.set(0, 0, 26);
    playerCar.rotation.y = 0;
    scene.add(playerCar);

    const cop1 = createCarMesh(0x2244ff, true);
    cop1.position.set(-10, 0, 26);
    cop1.rotation.y = 0;
    scene.add(cop1);

    const cop2 = createCarMesh(0x2244ff, true);
    cop2.position.set(-20, 0, 28);
    cop2.rotation.y = 0;
    scene.add(cop2);

    camera.position.set(16, 7, 8);
    camera.lookAt(0, 0, 26);

    const healthFill = document.getElementById('health-fill');
    const cashVal = document.getElementById('cash-val');
    const wantedStars = document.getElementById('wanted-stars');
    const objectiveText = document.getElementById('objective-text');

    if (healthFill) healthFill.style.width = '70%';
    if (cashVal) cashVal.textContent = '$1,700';
    if (wantedStars) wantedStars.textContent = '★★★☆☆';
    if (objectiveText) objectiveText.textContent = 'Harbor Heat: reach the safehouse!';

    drawMinimap({
      player: { pos: playerCar.position, angle: 0 },
      cars: [{ pos: playerCar.position }],
      police: [{ pos: cop1.position }, { pos: cop2.position }],
      mission: { marker: null },
      time: 0
    });

    return 'hud';
  }
  else if (name === 'mission') {
    const player = createPlayer(scene);
    player.onFoot = true;
    player.pos.set(26, 0, 66);
    player.mesh.position.copy(player.pos);
    player.angle = 0;

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

    beaconGroup.position.set(26, 0, 78);
    scene.add(beaconGroup);

    camera.position.set(26, 6, 54);
    camera.lookAt(26, 0, 78);

    const healthFill = document.getElementById('health-fill');
    const cashVal = document.getElementById('cash-val');
    const wantedStars = document.getElementById('wanted-stars');
    const objectiveText = document.getElementById('objective-text');

    if (healthFill) healthFill.style.width = '100%';
    if (cashVal) cashVal.textContent = '$500';
    if (wantedStars) wantedStars.textContent = '☆☆☆☆☆';
    if (objectiveText) objectiveText.textContent = "First Wheels: steal a car and bring it to Mara's garage.";

    drawMinimap({
      player: { pos: player.pos, angle: 0 },
      cars,
      police: [],
      mission: { marker: new THREE.Vector3(26, 0, 78) },
      time: 0
    });

    return 'hud';
  }

  return 'start-screen';
}
