// HUD and Minimap rendering
export function updateHUD(state) {
  const healthFill = document.getElementById('health-fill');
  const cashVal = document.getElementById('cash-val');
  const wantedStars = document.getElementById('wanted-stars');
  const objectiveText = document.getElementById('objective-text');

  if (healthFill) {
    healthFill.style.width = Math.max(0, Math.min(100, state.player.health)) + '%';
  }
  if (cashVal) {
    cashVal.textContent = '$' + (state.player.cash || 0).toLocaleString();
  }
  if (wantedStars) {
    const w = Math.max(0, Math.min(5, state.player.wanted || 0));
    wantedStars.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
  }
  if (objectiveText) {
    objectiveText.textContent = state.mission.objective || 'Explore Porto Verde. Find a car (Press E) or cruise the sunset streets.';
  }
}

export function drawMinimap(state) {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#111116';
  ctx.fillRect(0, 0, w, h);

  const pPos = state.player.pos;
  const scale = 2.5; // pixels per meter
  const cx = w / 2 - pPos.x * scale;
  const cy = h / 2 + pPos.z * scale;

  ctx.save();
  ctx.translate(cx, cy);

  // Draw roads (intersecting grid lines)
  ctx.strokeStyle = '#2d2d3a';
  ctx.lineWidth = 12 * scale;
  const totalPitch = 40 + 12;
  const minCoord = -4 * totalPitch - 26;
  const maxCoord = 4 * totalPitch + 26;

  for (let k = -4; k <= 4; k++) {
    const pos = k * totalPitch + 26;
    // Horizontal road at z = pos
    ctx.beginPath();
    ctx.moveTo(minCoord * scale, pos * scale);
    ctx.lineTo(maxCoord * scale, pos * scale);
    ctx.stroke();

    // Vertical road at x = pos
    ctx.beginPath();
    ctx.moveTo(pos * scale, minCoord * scale);
    ctx.lineTo(pos * scale, maxCoord * scale);
    ctx.stroke();
  }

  // Draw cars as dots (parked, traffic)
  if (state.cars) {
    for (const car of state.cars) {
      ctx.fillStyle = car.kind === 'traffic' ? '#777788' : '#ffaa00';
      ctx.fillRect(car.pos.x * scale - 3, car.pos.z * scale - 3, 6, 6);
    }
  }

  // Draw police cars as flashing red/blue dots
  if (state.police) {
    for (const pCar of state.police) {
      ctx.fillStyle = Math.sin((state.time || 0) * 12) > 0 ? '#ff2222' : '#2244ff';
      ctx.fillRect(pCar.pos.x * scale - 4, pCar.pos.z * scale - 4, 8, 8);
    }
  }

  // Draw mission marker
  if (state.mission && state.mission.marker) {
    const mx = state.mission.marker.x;
    const mz = state.mission.marker.z;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(mx * scale, mz * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw player arrow
  ctx.save();
  ctx.translate(pPos.x * scale, pPos.z * scale);
  ctx.rotate(state.player.angle || 0);
  ctx.fillStyle = '#ff3366';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Minimap border ring
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
}
