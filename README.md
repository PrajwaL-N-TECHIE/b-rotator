# B-Rotator • Candidate & Student Wheel Engine

> **Live Analytics & High-Capacity Spinning Wheel Engine**  
> Inspired by the **Buildicy Studio Design System** (B-Forms UI) with dual **Light & Dark Theme** support, **Syne** display typography, **Web Audio** synthesis, and scaling for **500–1,000+ candidate rosters**.

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Buildicy: Theme](https://img.shields.io/badge/Buildicy-B--Forms%20Style-7c3aed.svg)](https://buildicy.com)
[![Vanilla JS](https://img.shields.io/badge/Zero-Dependencies-emerald.svg)](index.html)

---

## ✨ Features

- 🎯 **High-Capacity Engine (500–1,000+ Candidates)**:
  - **Orbit Mode (1–60 candidates)**: Classic radial wedge sectors with outward-facing typography and LED perimeter illumination.
  - **Quantum Mode (60–1,000+ candidates)**: High-density rainbow spectrum sectors paired with a real-time **Live Needle Focus HUD** streaming candidate names at 60 FPS with live RPM velocity readouts.
- 🌓 **Dual Themes (Light & Dark)**:
  - **Light Theme**: Crisp porcelain slate (`#f8fafc` / `#ffffff`) with ambient purple highlights matching `bforms.buildicy.com`.
  - **Dark Theme**: Obsidian midnight (`#050507` / `#0e0c1a`) with electric violet and lavender glow.
  - Zero-flicker load with persistent `localStorage` synchronization.
- 🔤 **Authentic B-Forms Typography Trio**:
  - **Headings & Brand**: `Syne` (Geometric display bold, `-0.02em` tracking)
  - **Body & Controls**: `Plus Jakarta Sans`
  - **Data Badges & Numbers**: `DM Mono`
- 📁 **Universal Multi-Format File Importer**:
  - **Excel**: `.xlsx`, `.xls` via SheetJS CDN
  - **Delimited Data**: `.csv`, `.tsv` with automatic header and delimiter detection
  - **Plain Text**: `.txt`, `.md` (numbered lists, bullet points, line-delimited)
  - **Structured JSON**: `.json` (arrays of strings or candidate objects)
  - **Direct Clipboard Paste**: Built-in modal editor with live candidate counter
- 🔊 **Web Audio Synthesizer (Zero External Audio Files)**:
  - Mechanical clicker ticks pitch-modulated by wheel velocity
  - Spin acceleration whoosh
  - Harmonic victory fanfare chords
- 🏆 **Celebration & History**:
  - Full-screen high-performance confetti cannon
  - Accessible `<dialog>` celebration modal with winner copying
  - Optional **"Auto-remove winner from pool"** toggle for giveaways and exams
  - Winner history log with timestamps and 1-click **Export to CSV**
- 📱 **Fully Mobile & Tablet Optimized**:
  - Responsive 3-tab mobile dock navigation (`Wheel`, `Students`, `Winners`)
  - Fullscreen Presentation mode for projectors and smartboards

---

## 🚀 Quick Start

### 1. Zero-Dependency Local Server (Node.js)

```bash
git clone https://github.com/PrajwaL-N-TECHIE/b-rotator.git
cd b-rotator
npm start
```
Then visit: **`http://localhost:3456/`**

### 2. Direct Browser Use
You can also open [`index.html`](index.html) directly in any modern browser without needing a build step or server.

---

## 🛠️ Project Structure

```text
b-rotator/
├── index.html        # Main HTML5 application shell & dialog modals
├── style.css         # Complete B-Forms design system & light/dark theme rules
├── wheel-engine.js   # 60 FPS Canvas 2D wheel physics, flapper & confetti engine
├── importer.js       # Universal parser (Excel, CSV, TXT, JSON)
├── app.js            # App orchestrator, state management & theme switching
├── server.js         # Lightweight local dev server
├── package.json      # Project metadata & start scripts
├── favicon.svg       # Buildicy SVG favicon
└── logo.png          # Buildicy 3D isometric emblem
```

---

## 📄 License

MIT © [Buildicy](https://buildicy.com)
