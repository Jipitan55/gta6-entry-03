// Input handling: keyboard, mouse orbit, pointer lock
export function createInput() {
  const keys = {
    KeyW: false, KeyS: false, KeyA: false, KeyD: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    ShiftLeft: false, ShiftRight: false,
    KeyE: false, KeyF: false, KeyP: false, KeyM: false, Escape: false,
    Space: false
  };

  const mouse = {
    dx: 0,
    dy: 0,
    locked: false,
    click: false,
    down: false,
    lastX: 0,
    lastY: 0
  };

  window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = true;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
      keys[e.code] = false;
    }
  });

  return {
    keys,
    mouse,
    initMouse(domElement) {
      domElement.addEventListener('click', () => {
        if (!mouse.locked) {
          domElement.requestPointerLock?.();
        } else {
          mouse.click = true;
        }
      });

      document.addEventListener('pointerlockchange', () => {
        mouse.locked = (document.pointerLockElement === domElement);
      });

      document.addEventListener('mousemove', (e) => {
        if (mouse.locked) {
          mouse.dx += e.movementX;
          mouse.dy += e.movementY;
        }
      });

      domElement.addEventListener('mousedown', (e) => {
        mouse.down = true;
        mouse.click = true;
      });

      domElement.addEventListener('mouseup', () => {
        mouse.down = false;
      });
    },
    resetFrame() {
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.click = false;
    },
    isDown(code) {
      return !!keys[code];
    }
  };
}
