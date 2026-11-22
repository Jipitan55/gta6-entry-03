// Porto Verde - Main Game Loop, State Machine, Camera, Input & Wiring
import { CONFIG } from './config.js';
import { createRNG } from './random.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayerOnFoot } from './player.js';
import { buildCity } from './city.js';
import { spawnParkedCars, spawnTraffic, updateVehicles, updateTraffic, findNearestCar } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './people.js';
import { updatePolice, raiseWantedForCrime, getWanted } from './police.js';
import { updateHUD, drawMinimap } from './hud.js';
import { saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';
import { updateCombat } from './combat.js';
import { startMission, updateMissions } from './missions.js';
import { initAudio, updateAudio } from './audio.js';

const urlParams = new URLSearchParams(window.location.search);
const shotParam = urlParams.get('shot');
const seedParam = parseInt(urlParams.get('seed')) || 1;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.COLORS.sky);
scene.fog = new THREE.FogExp2(CONFIG.COLORS.sky, 0.003);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 1000);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x444455, 0.6);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
dirLight.position.set(100, 150, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 400;
dirLight.shadow.camera.left = -120;
dirLight.shadow.camera.right = 120;
dirLight.shadow.camera.top = 120;
dirLight.shadow.camera.bottom = -120;
scene.add(dirLight);

const input = createInput();
input.initMouse(canvas);

const rng = createRNG(seedParam);

const gameState = {
  mode: 'title', // title, play, pause, busted, wasted, complete
  time: 0,
  player: null,
  camera: { yaw: 0, pitch: 0.3, dist: 8 },
  mission: { index: 0, objective: 'Explore Porto Verde. Find a vehicle (Press E).' },
  cars: [],
  peds: [],
  police: [],
  colliders: [],
  dangers: [],
  input,
  rng,
  muted: false
};

const gameInstance = { scene, camera, renderer, gameState };

function initGame(savedData = null) {
  // Clear scene children except lights
  while (scene.children.length > 2) {
    scene.remove(scene.children[scene.children.length - 1]);
  }

  const cityData = buildCity(scene, rng);
  gameState.colliders = cityData.colliders;
  gameState.roads = cityData.roads;
  gameState.intersections = cityData.intersections;
  
  const parked = spawnParkedCars(scene, rng, 15);
  const traffic = spawnTraffic(scene, rng, 12, cityData.roads, cityData.intersections);
  gameState.cars = parked.concat(traffic);
  gameState.peds = createPedestrians(scene, rng, 20);
  gameState.police = [];

  const player = createPlayer(scene);
  if (savedData) {
    player.cash = savedData.cash || 500;
    player.health = savedData.health || 100;
    if (savedData.playerPos) {
      player.pos.set(...savedData.playerPos);
    }
  } else {
    player.pos.set(0, 0, 26);
    player.cash = 500;
    player.health = 100;
  }
  player.wanted = 0;
  player.mesh.position.copy(player.pos);
  gameState.player = player;

  startMission(gameState, savedData && savedData.missionIndex ? savedData.missionIndex : 0, scene);

  gameState.mode = 'play';
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
}

// UI wiring
document.getElementById('btn-new-game').addEventListener('click', () => {
  initAudio();
  initGame(null);
});

document.getElementById('btn-continue').addEventListener('click', () => {
  initAudio();
  const saved = loadGame();
  initGame(saved);
});

document.getElementById('btn-resume').addEventListener('click', () => {
  if (gameState.mode === 'busted' || gameState.mode === 'wasted') {
    initGame(null);
  } else {
    gameState.mode = 'play';
    document.getElementById('pause-screen').classList.add('hidden');
  }
});

document.getElementById('btn-quit').addEventListener('click', () => {
  gameState.mode = 'title';
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  initGame(null);
});

// Handle URL shot mode
if (shotParam) {
  const activeOverlay = stageShot(shotParam, gameInstance);
  document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
  const targetOverlay = document.getElementById(activeOverlay);
  if (targetOverlay) targetOverlay.classList.remove('hidden');
  function shotLoop() {
    requestAnimationFrame(shotLoop);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(shotLoop);
} else {
  // Normal game loop
  let lastTime = performance.now();
  let saveTimer = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Input checks for pause / resume / mute
    if (input.keys.KeyP || input.keys.Escape) {
      if (gameState.mode === 'play') {
        gameState.mode = 'pause';
        document.getElementById('pause-screen').classList.remove('hidden');
      } else if (gameState.mode === 'pause') {
        gameState.mode = 'play';
        document.getElementById('pause-screen').classList.add('hidden');
      }
      input.keys.KeyP = false;
      input.keys.Escape = false;
    }
    if (input.keys.KeyM) {
      gameState.muted = !gameState.muted;
      input.keys.KeyM = false;
    }

    if (gameState.mode === 'play') {
      gameState.time += dt;
      saveTimer += dt;
      if (saveTimer > 15) {
        saveGame(gameState);
        saveTimer = 0;
      }

      // Mouse camera rotation
      if (input.mouse.locked) {
        gameState.camera.yaw -= input.mouse.dx * 0.003;
        gameState.camera.pitch = Math.max(0.1, Math.min(1.4, gameState.camera.pitch + input.mouse.dy * 0.003));
      }

      // Enter/exit car (KeyE)
      if (input.keys.KeyE) {
        input.keys.KeyE = false;
        if (gameState.player.onFoot) {
          const nearest = findNearestCar(gameState.player.pos, gameState.cars, 5.0);
          if (nearest) {
            gameState.player.onFoot = false;
            gameState.player.car = nearest;
            scene.remove(gameState.player.mesh);
            if (nearest.kind === 'parked') {
              nearest.kind = 'stolen';
              raiseWantedForCrime(gameState, 'car_steal');
            }
            gameState.mission.objective = 'Driving! Cruise Porto Verde or press E to exit.';
          }
        } else {
          const car = gameState.player.car;
          if (car) {
            gameState.player.pos.set(car.pos.x + 2, 0, car.pos.z);
            scene.add(gameState.player.mesh);
            gameState.player.onFoot = true;
            gameState.player.car = null;
            gameState.mission.objective = 'On foot. Find a vehicle (Press E).';
          }
        }
      }

      // Update player / vehicles / traffic / pedestrians / police / combat / missions / audio
      if (gameState.player.onFoot) {
        updatePlayerOnFoot(dt, input, gameState.camera.yaw, gameState.colliders, gameState.player);
      } else {
        updateVehicles(dt, input, gameState.player.car, gameState.cars, gameState.colliders, true, gameState);
        gameState.player.pos.copy(gameState.player.car.pos);
        gameState.player.angle = gameState.player.car.angle;
      }

      updateVehicles(dt, input, null, gameState.cars, gameState.colliders, false, gameState);
      updateTraffic(dt, gameState);
      updatePedestrians(dt, gameState, gameState.dangers);
      updatePolice(dt, gameState, scene);
      updateCombat(dt, gameState, camera, scene, input);
      updateMissions(dt, gameState, scene, input);
      updateAudio(dt, gameState);

      // Check busted / health zero (wasted)
      if (gameState.player.health <= 0 && gameState.mode === 'play') {
        gameState.mode = 'wasted';
      }

      // Camera follow
      const targetPos = gameState.player.pos;
      const camDist = gameState.player.onFoot ? 7 : 10;
      const camHeight = gameState.player.onFoot ? 3 : 4;
      const camX = targetPos.x - Math.sin(gameState.camera.yaw) * camDist;
      const camZ = targetPos.z - Math.cos(gameState.camera.yaw) * camDist;
      camera.position.set(camX, targetPos.y + camHeight, camZ);
      camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z);

      updateHUD(gameState);
      drawMinimap(gameState);
    }

    if (gameState.mode === 'busted' || gameState.mode === 'wasted' || gameState.mode === 'complete') {
      const endScreen = document.getElementById('end-screen');
      const titleEl = document.getElementById('end-title');
      const subEl = document.getElementById('end-subtitle');
      if (endScreen) endScreen.classList.remove('hidden');
      if (titleEl) {
        titleEl.textContent = gameState.mode === 'busted' ? 'BUSTED' : (gameState.mode === 'wasted' ? 'WASTED' : 'STORY COMPLETE');
      }
      if (subEl) {
        if (gameState.mode === 'busted') {
          subEl.textContent = 'The law caught you on foot! Lost 20% cash.';
        } else if (gameState.mode === 'wasted') {
          subEl.textContent = 'You didn\'t survive Porto Verde sunset.';
        } else {
          subEl.textContent = `Sunset Heist successful! Total Cash: $${gameState.player.cash.toLocaleString()}`;
        }
      }
    }

    input.resetFrame();
    renderer.render(scene, camera);
  }

  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
