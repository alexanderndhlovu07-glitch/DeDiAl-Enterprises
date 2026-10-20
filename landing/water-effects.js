(() => {
  'use strict';

  // A deterministic water surface, drawn only when the central scene changes.
  // No clock, animation loop, timers, particles, or video are used here.
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const smooth = (a, b, value) => {
    const t = clamp((value - a) / Math.max(0.00001, b - a));
    return t * t * (3 - 2 * t);
  };
  const noise = value => {
    const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  let canvas, context, scene, ship;
  let geometry = null;
  let signature = '';
  let lastContact = null;

  function ensure() {
    if (!canvas?.isConnected) {
      canvas = document.querySelector('#hero-water-effects');
      scene = canvas?.closest('.hero-object-stage');
      ship = scene?.querySelector('.hero-ship-depth');
      context = canvas?.getContext('2d', { alpha: true });
      geometry = null;
    }
    return !!(canvas && context && scene && ship);
  }

  function resize() {
    if (!ensure()) return;
    // Layout reads are confined to resize, called from the scene's measure pass.
    const width = scene.clientWidth;
    const height = scene.clientHeight;
    if (!width || !height) return;
    const shipStyle = getComputedStyle(ship);
    const sceneStyle = getComputedStyle(scene);
    const origin = shipStyle.transformOrigin.split(' ').map(Number.parseFloat);
    const perspectiveOrigin = sceneStyle.perspectiveOrigin.split(' ').map(Number.parseFloat);
    const perspective = Number.parseFloat(sceneStyle.perspective) || 1100;
    const dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    geometry = {
      width, height, dpr, perspective,
      cameraX: finite(perspectiveOrigin[0], width / 2),
      cameraY: finite(perspectiveOrigin[1], height / 2),
      left: ship.offsetLeft, top: ship.offsetTop,
      shipWidth: ship.offsetWidth, shipHeight: ship.offsetHeight,
      originX: finite(origin[0], ship.offsetWidth / 2),
      originY: finite(origin[1], ship.offsetHeight * 0.75),
    };
    signature = '';
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
  }

  function project(state) {
    const g = geometry;
    const scale = Math.max(0.01, finite(state.shipScale, 1));
    const z = finite(state.shipZ);
    const factor = clamp(g.perspective / Math.max(g.perspective * 0.16, g.perspective - z), 0.2, 6.25);
    const angle = finite(state.shipRotate) * Math.PI / 180;
    const localX = g.shipWidth * 0.5 - g.originX;
    // The last 4–5% of the cutout is transparent padding below the bow.
    const localY = g.shipHeight * 0.952 - g.originY;
    const x = g.left - g.shipWidth * 0.5 + finite(state.shipXpx) + g.originX
      + (localX * Math.cos(angle) - localY * Math.sin(angle)) * scale;
    const y = g.top + finite(state.shipYpx) + g.originY
      + (localX * Math.sin(angle) + localY * Math.cos(angle)) * scale;
    return {
      x: g.cameraX + (x - g.cameraX) * factor,
      y: g.cameraY + (y - g.cameraY) * factor,
      beam: g.shipWidth * scale * factor,
      factor,
    };
  }

  function render(state = {}) {
    if (!ensure()) return null;
    if (!geometry || (state.sceneWidth && Math.abs(state.sceneWidth - geometry.width) > 1)
      || (state.sceneHeight && Math.abs(state.sceneHeight - geometry.height) > 1)) resize();
    if (!geometry) return null;
    const progress = clamp(finite(state.progress));
    const travel = clamp(finite(state.shipProgress, progress));
    const opacity = clamp(finite(state.shipOpacity, 1));
    const key = [progress, travel, state.shipXpx, state.shipYpx, state.shipScale, state.shipZ,
      state.shipRotate, opacity, !!state.disabled, !!state.compact]
      .map(v => typeof v === 'number' ? v.toFixed(5) : v).join(':');
    if (key === signature) return lastContact;
    signature = key;
    const { width, height, dpr } = geometry;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (state.disabled) {
      lastContact = null;
      return null;
    }
    const projectedBow = project(state);
    lastContact = { ...projectedBow, width, height };
    // Water left in the foreground remains after the bow crosses the frame.
    const bow = { ...projectedBow, y: Math.min(projectedBow.y, height * 1.055) };
    const settling = 1 - smooth(0.9, 1, progress);
    const presence = Math.max(opacity, (1 - smooth(0.86, 0.99, progress)) * 0.7);
    const strength = (0.22 + smooth(0.02, 0.4, travel) * 0.78) * presence * settling;
    if (strength < 0.005 || bow.y < height * 0.45) return lastContact;

    const beam = Math.min(bow.beam, width * 0.65);
    const phase = travel * 8.4 + progress * 2.6;
    const length = Math.min(height * 0.48, Math.max(height * 0.15, bow.y - height * 0.505));
    const wake = (t, side, band = 0) => {
      const spread = beam * (0.18 + t * 0.62 + band * 0.022);
      const wobble = Math.sin(t * 21 + phase + band) * beam * 0.009 * Math.sin(Math.PI * t);
      return { x: bow.x + side * spread + wobble, y: bow.y - length * t + Math.sin(t * 15 + phase) * 1.1 };
    };
    const traceWake = (side, band, offset = 0) => {
      context.beginPath();
      for (let n = 0; n <= 26; n++) {
        const p = wake(n / 26, side, band);
        if (n === 0) context.moveTo(p.x, p.y + offset);
        else context.lineTo(p.x, p.y + offset);
      }
    };

    context.save();
    // The port is dry land; all surface marks stay inside the widening channel.
    context.beginPath();
    context.moveTo(width * 0.435, height * 0.475);
    context.lineTo(width * 0.605, height * 0.475);
    context.lineTo(width * 0.98, height);
    context.lineTo(width * 0.10, height);
    context.closePath();
    context.clip();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Broad translucent churn gives the fine foam a body in the water.
    for (const side of [-1, 1]) {
      context.beginPath();
      for (let n = 0; n <= 32; n++) {
        const t = n / 32;
        const point = wake(t, side);
        const thickness = beam * (0.025 + Math.sin(t * Math.PI) * 0.045);
        const jitter = Math.sin(t * 71 + phase * 2.3) * thickness * 0.25;
        const px = point.x + side * (thickness + jitter);
        if (!n) context.moveTo(px, point.y);
        else context.lineTo(px, point.y);
      }
      for (let n = 32; n >= 0; n--) {
        const t = n / 32;
        const point = wake(t, side);
        context.lineTo(point.x - side * beam * 0.018, point.y);
      }
      context.closePath();
      const churn = context.createLinearGradient(0, bow.y - length, 0, bow.y);
      churn.addColorStop(0, 'rgba(221,238,229,0)');
      churn.addColorStop(0.4, `rgba(221,238,229,${0.12 * strength})`);
      churn.addColorStop(1, `rgba(245,249,239,${0.36 * strength})`);
      context.fillStyle = churn;
      context.fill();
    }

    // Thin dark/light pairs displace the reflections beside the turbulent foam.
    for (const side of [-1, 1]) {
      traceWake(side, 1, 2);
      context.strokeStyle = `rgba(21,57,58,${0.10 * strength})`;
      context.lineWidth = Math.max(1.2, beam * 0.026);
      context.stroke();
      for (let band = 0; band < 5; band++) {
        traceWake(side, band, band * 0.55);
        context.strokeStyle = `rgba(234,244,240,${(0.08 + (4 - band) * 0.035) * strength})`;
        context.lineWidth = Math.max(0.6, beam * (0.014 - band * 0.0017));
        context.stroke();
      }
    }

    // Irregular foam filaments slide along each arm as scroll progress changes.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 34; i++) {
        const t = clamp((i + 0.25 + Math.sin(phase + i * 1.7) * 0.16) / 34);
        const position = wake(t, side, noise(i + side * 37) * 3);
        position.x += (noise(i * 4 + side * 13) - 0.5) * beam * 0.06;
        const radius = Math.max(0.6, beam * (0.006 + noise(i * 3 + side * 7) * 0.011) * (1 - t * 0.52));
        const alpha = Math.sin(Math.PI * clamp(t * 0.92 + 0.035)) * strength;
        context.beginPath();
        context.ellipse(position.x, position.y, radius * (1.1 + noise(i) * 1.8), radius * 0.35,
          side * -0.28, 0, Math.PI * 2);
        context.fillStyle = `rgba(237,245,240,${alpha * (0.25 + noise(i + 23) * 0.35)})`;
        context.fill();
      }
    }

    // The immediate bow pushes water sideways; paired arcs create refraction.
    for (let ring = 0; ring < 5; ring++) {
      const expand = (travel * 2.1 + ring / 5) % 1;
      const ringAlpha = Math.sin(Math.PI * expand) * strength * 0.24;
      const radius = beam * (0.23 + expand * 0.51);
      const cy = bow.y + expand * beam * 0.065;
      context.beginPath();
      context.ellipse(bow.x, cy + 1.3, radius, radius * 0.19, 0, 0.04 * Math.PI, 0.96 * Math.PI);
      context.strokeStyle = `rgba(18,57,60,${ringAlpha * 0.42})`;
      context.lineWidth = 1.4;
      context.stroke();
      context.beginPath();
      context.ellipse(bow.x, cy, radius, radius * 0.19, 0, 0.04 * Math.PI, 0.96 * Math.PI);
      context.strokeStyle = `rgba(238,246,239,${ringAlpha})`;
      context.lineWidth = Math.max(0.6, 1.5 - expand);
      context.stroke();
    }
    // A short, broken bow wave hugs the waterline instead of outlining the image.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const t = i / 25;
        const px = bow.x + side * beam * (0.04 + t * 0.40);
        const py = bow.y + beam * (Math.sin(t * Math.PI) * 0.025 - t * t * 0.072)
          + Math.sin(t * 37 + phase) * beam * 0.005;
        const size = beam * (0.008 + noise(i + side * 89) * 0.016);
        context.beginPath();
        context.ellipse(px, py, size, Math.max(0.5, size * 0.26), -side * t * 0.3, 0, Math.PI * 2);
        context.fillStyle = `rgba(242,247,240,${(0.18 + noise(i + 31) * 0.36) * strength * opacity})`;
        context.fill();
      }
    }
    context.restore();
    return lastContact;
  }

  window.DEDIAL_WATER = Object.freeze({ render, resize });
})();
