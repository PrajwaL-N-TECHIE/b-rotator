/**
 * High-Performance Canvas Wheel Engine (Official Buildicy Theme)
 * Inspired by B-Forms UI: Deep obsidian #050507, Electric Violet #7c3aed,
 * Buildicy 3D Isometric Logo in Center Hub, 60 FPS physics, and Web Audio.
 */

export class WheelEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.options = Object.assign({
      theme: 'buildicy',
      themeMode: (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) ? 'light' : 'dark',
      onSpinStart: () => {},
      onSpinStep: (candidate, speed) => {},
      onSpinEnd: (winner, index) => {},
      onPinTick: (speed) => {}
    }, options);

    this.themeMode = this.options.themeMode || 'dark';

    this.candidates = [];
    this.currentAngle = 0;
    this.angularVelocity = 0;
    this.isSpinning = false;
    this.spinDuration = 6;
    this.spinStartTime = 0;
    this.startAngle = 0;
    this.targetAngle = 0;
    this.winnerIndex = -1;
    this.lastPinTickIndex = -1;

    // Flapper physics
    this.pointerDeflection = 0;

    // Device Pixel Ratio capped at 2 for performance
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.setupCanvas();

    // Official Buildicy Tiered 3D Emblem Image
    this.logoImg = new Image();
    this.logoImg.src = 'logo.png';
    this.logoImg.onload = () => {
      this.render();
    };

    // Sound FX Synth (B-Forms Acoustic Module)
    this.audioEngine = new WheelAudioEngine();

    // Confetti System
    this.confetti = new ConfettiSystem();

    // B-Forms & Buildicy Signature Palettes
    this.palettes = {
      buildicy: [
        '#7c3aed', '#8b5cf6', '#a855f7', '#6366f1', '#4f46e5',
        '#06b6d4', '#0ea5e9', '#ec4899', '#f43f5e', '#10b981'
      ],
      neon: [
        '#9333ea', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
        '#ec4899', '#a855f7', '#14b8a6', '#6366f1', '#e11d48'
      ],
      gold: [
        '#7c3aed', '#ca8a04', '#eab308', '#9333ea', '#d97706',
        '#1e1b4b', '#4c1d95', '#f59e0b', '#3b82f6', '#8b5cf6'
      ]
    };

    this.rafId = null;
    this.lastFrameTime = performance.now();

    let resizeTimer = null;
    this.resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.setupCanvas(), 50);
    });
    this.resizeObserver.observe(this.canvas.parentElement);

    this.render();
  }

  setupCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height > 100 ? rect.height : rect.width));
    const canvasSize = Math.max(260, size);

    this.width = canvasSize;
    this.height = canvasSize;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.radius = (this.width / 2) * 0.91;

    this.render();
  }

  setCandidates(list) {
    this.candidates = Array.isArray(list) ? list.filter(item => typeof item === 'string' && item.trim().length > 0) : [];
    this.lastPinTickIndex = -1;
    this.render();
  }

  setTheme(themeName) {
    if (this.palettes[themeName]) {
      this.options.theme = themeName;
      this.render();
    }
  }

  spin(durationSeconds = 6, forceWinnerIndex = null) {
    if (this.isSpinning || this.candidates.length === 0) return false;

    this.isSpinning = true;
    this.spinDuration = Math.max(2.5, Math.min(15, durationSeconds));
    this.spinStartTime = performance.now();
    this.startAngle = this.currentAngle % (2 * Math.PI);

    const N = this.candidates.length;
    const sliceAngle = (2 * Math.PI) / N;

    if (forceWinnerIndex !== null && forceWinnerIndex >= 0 && forceWinnerIndex < N) {
      this.winnerIndex = forceWinnerIndex;
    } else {
      this.winnerIndex = Math.floor(Math.random() * N);
    }

    const pointerAngle = -Math.PI / 2;
    const sliceMargin = sliceAngle * 0.15;
    const randomWithinSlice = sliceMargin + Math.random() * (sliceAngle - 2 * sliceMargin);
    const targetSliceOffset = this.winnerIndex * sliceAngle + randomWithinSlice;

    let finalBaseAngle = pointerAngle - targetSliceOffset;
    while (finalBaseAngle < 0) finalBaseAngle += 2 * Math.PI;

    const minRotations = Math.floor(this.spinDuration * 2.6) + 3;
    const totalSpinRotation = minRotations * 2 * Math.PI + (finalBaseAngle - (this.startAngle % (2 * Math.PI)));
    const totalRotation = totalSpinRotation < minRotations * 2 * Math.PI 
      ? totalSpinRotation + 2 * Math.PI 
      : totalSpinRotation;

    this.targetAngle = this.startAngle + totalRotation;

    this.audioEngine.startSpinWhoosh();
    this.options.onSpinStart();

    this.lastFrameTime = performance.now();
    this.animate();
    return true;
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3.2);
  }

  animate() {
    if (!this.isSpinning) return;

    const now = performance.now();
    const elapsed = (now - this.spinStartTime) / 1000;
    const t = Math.min(1, elapsed / this.spinDuration);

    if (t < 1) {
      const easedProgress = this.easeOutCubic(t);
      const prevAngle = this.currentAngle;
      this.currentAngle = this.startAngle + (this.targetAngle - this.startAngle) * easedProgress;

      const dt = Math.max(0.001, (now - this.lastFrameTime) / 1000);
      const frameDelta = this.currentAngle - prevAngle;
      const speed = frameDelta / dt;

      this.handlePinTicks(speed);

      const currentPassingCandidate = this.getActiveCandidate();
      this.options.onSpinStep(currentPassingCandidate, speed);

      this.pointerDeflection *= 0.82;

      this.lastFrameTime = now;
      this.render();
      this.rafId = requestAnimationFrame(() => this.animate());
    } else {
      this.currentAngle = this.targetAngle;
      this.isSpinning = false;
      this.pointerDeflection = 0;
      this.audioEngine.stopSpinWhoosh();
      this.render();

      const winner = this.candidates[this.winnerIndex];
      this.audioEngine.playWinnerFanfare();
      this.confetti.fire();

      this.options.onSpinEnd(winner, this.winnerIndex);
    }
  }

  getActiveCandidate() {
    if (this.candidates.length === 0) return null;
    const N = this.candidates.length;
    const sliceAngle = (2 * Math.PI) / N;
    const pointerAngle = -Math.PI / 2;

    let relAngle = (pointerAngle - this.currentAngle) % (2 * Math.PI);
    if (relAngle < 0) relAngle += 2 * Math.PI;

    const index = Math.floor(relAngle / sliceAngle) % N;
    return {
      index,
      name: this.candidates[index],
      total: N
    };
  }

  handlePinTicks(speed) {
    if (this.candidates.length === 0) return;
    const N = this.candidates.length;
    
    const pinCount = N <= 80 ? N : Math.min(90, Math.floor(N / 6));
    const pinAngle = (2 * Math.PI) / pinCount;
    const pointerAngle = -Math.PI / 2;

    let relAngle = (pointerAngle - this.currentAngle) % (2 * Math.PI);
    if (relAngle < 0) relAngle += 2 * Math.PI;

    const currentPin = Math.floor(relAngle / pinAngle);

    if (currentPin !== this.lastPinTickIndex) {
      this.lastPinTickIndex = currentPin;
      this.pointerDeflection = 1.0;
      this.audioEngine.playTick(speed);
      this.options.onPinTick(speed);
    }
  }

  setThemeMode(mode) {
    this.themeMode = mode || 'dark';
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.radius;
    const N = this.candidates.length;
    const isLight = this.themeMode === 'light';

    // Canvas Background
    ctx.fillStyle = isLight ? '#f8fafc' : '#050507';
    ctx.fillRect(0, 0, w, h);

    if (N === 0) {
      this.renderEmptyState(isLight);
      return;
    }

    ctx.save();

    // Purple glow aura
    ctx.shadowBlur = isLight ? 16 : 28;
    ctx.shadowColor = isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(168, 85, 247, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, 2 * Math.PI);
    ctx.fillStyle = isLight ? '#ffffff' : '#0c0a17';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bezel with Buildicy gradient
    const outerRimGrad = ctx.createRadialGradient(cx, cy, r + 1, cx, cy, r + 14);
    if (isLight) {
      outerRimGrad.addColorStop(0, '#ffffff');
      outerRimGrad.addColorStop(0.5, '#ede9fe');
      outerRimGrad.addColorStop(1, '#cbd5e1');
    } else {
      outerRimGrad.addColorStop(0, '#1a162b');
      outerRimGrad.addColorStop(0.5, '#4c1d95');
      outerRimGrad.addColorStop(1, '#050507');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12, 0, 2 * Math.PI);
    ctx.fillStyle = outerRimGrad;
    ctx.fill();

    // Outer bezel LEDs
    this.renderBezelLEDs(cx, cy, r + 6, isLight);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.currentAngle);

    if (N <= 60) {
      this.renderStandardWheel(ctx, r, N);
    } else {
      this.renderHighDensityWheel(ctx, r, N);
    }

    ctx.restore();

    // Center Hub featuring the Buildicy 3D Logo!
    this.renderCenterHub(ctx, cx, cy, r * 0.25);

    // Pointer flapper needle
    this.renderPointer(ctx, cx, cy - r, r);

    ctx.restore();
  }

  renderStandardWheel(ctx, r, N) {
    const sliceAngle = (2 * Math.PI) / N;
    const palette = this.palettes[this.options.theme] || this.palettes.buildicy;

    for (let i = 0; i < N; i++) {
      const startA = i * sliceAngle;
      const endA = startA + sliceAngle;
      const color = palette[i % palette.length];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startA, endA);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Soft 3D bevel shading
      const sliceGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      sliceGrad.addColorStop(0, 'rgba(5, 5, 7, 0.45)');
      sliceGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
      sliceGrad.addColorStop(1, 'rgba(5, 5, 7, 0.35)');
      ctx.fillStyle = sliceGrad;
      ctx.fill();

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Outer pin dot
      const pinX = Math.cos(startA) * (r - 3);
      const pinY = Math.sin(startA) * (r - 3);
      ctx.beginPath();
      ctx.arc(pinX, pinY, 2.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Candidate Text
      ctx.save();
      ctx.rotate(startA + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const fontSize = Math.max(9, Math.min(16, Math.floor(360 / Math.max(12, N))));
      ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#ffffff';

      const maxTextWidth = r * 0.62;
      const candidateName = this.truncateText(ctx, this.candidates[i], maxTextWidth);
      ctx.fillText(candidateName, r - 14, 0);

      ctx.restore();
    }
  }

  renderHighDensityWheel(ctx, r, N) {
    const sliceAngle = (2 * Math.PI) / N;
    const palette = this.palettes[this.options.theme] || this.palettes.buildicy;

    for (let i = 0; i < N; i++) {
      const startA = i * sliceAngle;
      const endA = startA + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startA, endA);
      ctx.closePath();

      if (N >= 300) {
        // Buildicy violet-to-cyan-to-pink gradient spectrum
        const hue = (260 + (i * (360 / N))) % 360;
        ctx.fillStyle = `hsl(${hue}, 82%, 58%)`;
      } else {
        ctx.fillStyle = palette[i % palette.length];
      }
      ctx.fill();
    }

    // Depth overlay
    const depthGrad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
    depthGrad.addColorStop(0, 'rgba(5, 5, 7, 0.95)');
    depthGrad.addColorStop(0.3, 'rgba(5, 5, 7, 0.35)');
    depthGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
    depthGrad.addColorStop(1, 'rgba(5, 5, 7, 0.65)');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = depthGrad;
    ctx.fill();

    // Edge ticks
    const tickCount = Math.min(100, N);
    const tickAngle = (2 * Math.PI) / tickCount;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;

    for (let t = 0; t < tickCount; t++) {
      const a = t * tickAngle;
      const innerR = t % 10 === 0 ? r - 12 : (t % 5 === 0 ? r - 8 : r - 5);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
  }

  /**
   * Renders the Official Buildicy 3D Layered Isometric Diamond Logo in the Center Hub
   */
  renderCenterHub(ctx, cx, cy, hubRadius) {
    const isLight = this.themeMode === 'light';
    ctx.save();

    // Outer hub ring with purple glow
    ctx.shadowBlur = isLight ? 12 : 18;
    ctx.shadowColor = isLight ? 'rgba(124, 58, 237, 0.35)' : 'rgba(168, 85, 247, 0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius + 5, 0, 2 * Math.PI);
    ctx.fillStyle = isLight ? '#ffffff' : '#0e0c1a';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Metallic inner bevel
    const hubGrad = ctx.createLinearGradient(cx - hubRadius, cy - hubRadius, cx + hubRadius, cy + hubRadius);
    if (isLight) {
      hubGrad.addColorStop(0, '#ffffff');
      hubGrad.addColorStop(0.5, '#f5f3ff');
      hubGrad.addColorStop(1, '#ede9fe');
    } else {
      hubGrad.addColorStop(0, '#2e1065');
      hubGrad.addColorStop(0.5, '#050507');
      hubGrad.addColorStop(1, '#4c1d95');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // Purple rim
    ctx.strokeStyle = isLight ? '#7c3aed' : '#a855f7';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Center Core Disk
    const coreGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, hubRadius * 0.72);
    if (isLight) {
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.8, '#f5f3ff');
      coreGrad.addColorStop(1, '#ede9fe');
    } else {
      coreGrad.addColorStop(0, '#1e1638');
      coreGrad.addColorStop(0.8, '#0b0914');
      coreGrad.addColorStop(1, '#050507');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, hubRadius * 0.72, 0, 2 * Math.PI);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // DRAW THE EXACT BUILDICY 3D TIERED LOGO INSIDE HUB
    if (this.logoImg && this.logoImg.complete && this.logoImg.naturalWidth > 0) {
      const imgSize = hubRadius * 0.95;
      ctx.drawImage(this.logoImg, cx - imgSize / 2, cy - imgSize / 2 - 3, imgSize, imgSize);
    } else {
      const logoScale = (hubRadius * 0.6) / 36;
      ctx.save();
      ctx.translate(cx, cy - 2);
      ctx.scale(logoScale, logoScale);

      // Layer 1 (Bottom deep purple #5b21b6): M8 54 L34 68 L60 54 L34 40 Z
      ctx.beginPath();
      ctx.moveTo(8 - 34, 54 - 38);
      ctx.lineTo(34 - 34, 68 - 38);
      ctx.lineTo(60 - 34, 54 - 38);
      ctx.lineTo(34 - 34, 40 - 38);
      ctx.closePath();
      ctx.fillStyle = '#5b21b6';
      ctx.fill();

      // Layer 2 (Middle electric violet #7c3aed): M14 36 L34 46 L54 36 L34 26 Z
      ctx.beginPath();
      ctx.moveTo(14 - 34, 36 - 38);
      ctx.lineTo(34 - 34, 46 - 38);
      ctx.lineTo(54 - 34, 36 - 38);
      ctx.lineTo(34 - 34, 26 - 38);
      ctx.closePath();
      ctx.fillStyle = '#7c3aed';
      ctx.fill();

      // Layer 3 (Top lavender #c084fc): M20 15.5 L34 22.5 L48 15.5 L34 8.5 Z
      ctx.beginPath();
      ctx.moveTo(20 - 34, 15.5 - 38);
      ctx.lineTo(34 - 34, 22.5 - 38);
      ctx.lineTo(48 - 34, 15.5 - 38);
      ctx.lineTo(34 - 34, 8.5 - 38);
      ctx.closePath();
      ctx.fillStyle = '#c084fc';
      ctx.fill();

      // Top dot (White circle at cx: 34, cy: 8.5, r: 3.5)
      ctx.beginPath();
      ctx.arc(34 - 34, 8.5 - 38, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }

    // Subtext below logo
    ctx.fillStyle = isLight ? '#6d28d9' : '#c084fc';
    ctx.font = `800 ${Math.max(8, Math.floor(hubRadius * 0.22))}px "Syne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.isSpinning ? 'SPINNING' : 'BUILDICY', cx, cy + hubRadius * 0.52);

    ctx.restore();
  }

  renderPointer(ctx, cx, topY, r) {
    ctx.save();
    ctx.translate(cx, topY);

    const deflectionAngle = this.pointerDeflection * 0.16;
    ctx.rotate(deflectionAngle);

    ctx.shadowBlur = 16;
    ctx.shadowColor = '#a855f7';

    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(-13, -16);
    ctx.lineTo(13, -16);
    ctx.closePath();

    const needleGrad = ctx.createLinearGradient(0, -16, 0, 22);
    needleGrad.addColorStop(0, '#c084fc');
    needleGrad.addColorStop(0.5, '#7c3aed');
    needleGrad.addColorStop(1, '#5b21b6');
    ctx.fillStyle = needleGrad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -12, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  renderBezelLEDs(cx, cy, ledRadius, isLight = false) {
    const ledCount = 32;
    const now = performance.now();
    const animOffset = (now / 160) % ledCount;

    for (let i = 0; i < ledCount; i++) {
      const angle = (i * 2 * Math.PI) / ledCount;
      const x = cx + Math.cos(angle) * ledRadius;
      const y = cy + Math.sin(angle) * ledRadius;

      const isLit = this.isSpinning 
        ? Math.floor((i + animOffset) % 3) === 0 
        : i % 2 === 0;

      this.ctx.beginPath();
      this.ctx.arc(x, y, 2.4, 0, 2 * Math.PI);
      this.ctx.fillStyle = isLit 
        ? '#ffffff' 
        : (isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(255, 255, 255, 0.15)');
      if (isLit) {
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = '#a855f7';
      }
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }

  renderEmptyState(isLight = false) {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;

    ctx.strokeStyle = isLight ? 'rgba(124, 58, 237, 0.25)' : 'rgba(168, 85, 247, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, this.radius * 0.72, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.logoImg && this.logoImg.complete && this.logoImg.naturalWidth > 0) {
      const logoW = 56;
      const logoH = 56;
      ctx.drawImage(this.logoImg, cx - logoW / 2, cy - 65, logoW, logoH);
    }

    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload or paste student roster to begin', cx, cy + 8);

    ctx.fillStyle = isLight ? '#7c3aed' : '#c084fc';
    ctx.font = '700 13px "Syne", sans-serif';
    ctx.fillText('SUPPORTS 500 - 1000 CANDIDATES', cx, cy + 34);
  }

  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 2 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '…';
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.audioEngine.destroy();
  }
}

class WheelAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.whooshOsc = null;
    this.whooshGain = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.muted && this.whooshGain && this.ctx) {
      this.whooshGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  playTick(speed = 10) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 540 + Math.min(480, speed * 24);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.032);

      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.032);
    } catch (e) {}
  }

  startSpinWhoosh() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      this.whooshOsc = this.ctx.createOscillator();
      this.whooshGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, t);
      filter.frequency.exponentialRampToValueAtTime(750, t + 2);

      this.whooshOsc.type = 'sawtooth';
      this.whooshOsc.frequency.setValueAtTime(80, t);

      this.whooshGain.gain.setValueAtTime(0.001, t);
      this.whooshGain.gain.linearRampToValueAtTime(0.04, t + 1);

      this.whooshOsc.connect(filter);
      filter.connect(this.whooshGain);
      this.whooshGain.connect(this.ctx.destination);

      this.whooshOsc.start(t);
    } catch (e) {}
  }

  stopSpinWhoosh() {
    if (this.whooshGain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.whooshGain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        if (this.whooshOsc) {
          this.whooshOsc.stop(t + 0.4);
          this.whooshOsc = null;
        }
      } catch (e) {}
    }
  }

  playWinnerFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [
        { f: 523.25, time: 0 },
        { f: 659.25, time: 0.11 },
        { f: 783.99, time: 0.22 },
        { f: 1046.50, time: 0.35 }
      ];

      const start = this.ctx.currentTime;

      notes.forEach((note, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteStart = start + note.time;
        const dur = index === notes.length - 1 ? 1.1 : 0.32;

        osc.type = index === notes.length - 1 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(note.f, noteStart);

        gain.gain.setValueAtTime(0.22, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + dur);
      });
    } catch (e) {}
  }

  destroy() {
    if (this.ctx) {
      try { this.ctx.close(); } catch (e) {}
    }
  }
}

class ConfettiSystem {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animId = null;
    this.setupCanvas();
  }

  setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'confetti-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 99999;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  fire(count = 250) {
    this.particles = [];
    const colors = ['#7c3aed', '#a855f7', '#c084fc', '#06b6d4', '#ec4899', '#f59e0b', '#ffffff'];
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < count; i++) {
      const originX = i % 2 === 0 ? w * 0.25 : w * 0.75;
      const angle = i % 2 === 0 
        ? -Math.PI / 4 + (Math.random() - 0.5) * 0.65 
        : -3 * Math.PI / 4 + (Math.random() - 0.5) * 0.65;
      const speed = 13 + Math.random() * 20;

      this.particles.push({
        x: originX,
        y: h * 0.82,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        isRibbon: Math.random() > 0.55,
        life: 1.0,
        decay: 0.006 + Math.random() * 0.006
      });
    }

    if (!this.animId) {
      this.animate();
    }
  }

  animate() {
    if (this.particles.length === 0) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.animId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const gravity = 0.44;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.vx *= 0.985;
      p.rotation += p.rotationSpeed;
      p.life -= p.decay;

      if (p.life <= 0 || p.y > this.canvas.height + 40) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle = p.color;

      if (p.isRibbon) {
        this.ctx.fillRect(-p.size * 1.4, -p.size * 0.35, p.size * 2.8, p.size * 0.7);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size * 0.55, 0, 2 * Math.PI);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    this.animId = requestAnimationFrame(() => this.animate());
  }
}
