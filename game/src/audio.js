// WebAudio synthesis module with zero external audio files
let audioCtx = null;
let masterGain = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;

export function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);

    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(masterGain);
    engineOsc.start();

    sirenOsc = audioCtx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 600;
    sirenGain = audioCtx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(masterGain);
    sirenOsc.start();

    window.playSound = playSound;
  } catch (e) {
    console.warn('WebAudio not supported or blocked', e);
  }
}

export function playSound(name) {
  if (!audioCtx || audioCtx.state === 'suspended') {
    if (audioCtx) audioCtx.resume();
  }
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  if (name === 'click') {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
    g.gain.setValueAtTime(0.2, now);
    g.gain.linearRampToValueAtTime(0.01, now + 0.05);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (name === 'punch') {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
    g.gain.setValueAtTime(0.4, now);
    g.gain.linearRampToValueAtTime(0.01, now + 0.15);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (name === 'gunshot') {
    const bufferSize = audioCtx.sampleRate * 0.1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.6, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    noise.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    noise.start(now);
  } else if (name === 'blip') {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    g.gain.setValueAtTime(0.2, now);
    g.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export function updateAudio(dt, state) {
  if (!masterGain) return;
  masterGain.gain.value = state.muted ? 0 : 0.3;

  if (!audioCtx) return;

  if (!state.player.onFoot && state.player.car) {
    engineGain.gain.value = 0.15;
    const speed = Math.abs(state.player.car.speed || 0);
    engineOsc.frequency.setValueAtTime(50 + speed * 6, audioCtx.currentTime);
  } else {
    engineGain.gain.value = 0;
  }

  let nearPolice = false;
  if (state.police && state.player) {
    for (const pCar of state.police) {
      if (pCar.pos.distanceTo(state.player.pos) < 60.0) {
        nearPolice = true;
        break;
      }
    }
  }

  if (nearPolice) {
    sirenTimer += dt * 3;
    const freq = Math.sin(sirenTimer) > 0 ? 700 : 500;
    sirenOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    sirenGain.gain.value = 0.12;
  } else {
    sirenGain.gain.value = 0;
  }
}
