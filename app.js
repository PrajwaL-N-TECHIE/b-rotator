/**
 * Buildicy Wheel Rotator Application Orchestrator
 * Mobile-optimized, ultra-fast initial render, responsive tab manager.
 */

import { WheelEngine } from './wheel-engine.js';
import { StudentImporter } from './importer.js';

class StudentWheelApp {
  constructor() {
    this.importer = new StudentImporter();
    
    // State
    this.masterCandidates = [];
    this.activeCandidates = [];
    this.pickedHistory = [];
    this.currentWinner = null;
    this.roundsCount = 0;
    this.soundMuted = false;

    // DOM Elements
    this.canvas = document.getElementById('wheel-canvas');
    this.spinBtn = document.getElementById('spin-main-btn');
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('file-input');
    this.rosterList = document.getElementById('roster-list');
    this.searchInput = document.getElementById('roster-search-input');
    this.durationSlider = document.getElementById('duration-slider');
    this.durationValLabel = document.getElementById('duration-val');
    this.autoRemoveCheckbox = document.getElementById('auto-remove-toggle');

    // Badges & Metrics
    this.totalBadge = document.getElementById('total-count-badge');
    this.poolBadge = document.getElementById('pool-count-badge');
    this.pickedBadge = document.getElementById('picked-count-badge');
    this.mobilePoolBadge = document.getElementById('mobile-pool-count');
    this.mobileWonBadge = document.getElementById('mobile-won-count');
    this.statOdds = document.getElementById('stat-odds');
    this.statPoolSize = document.getElementById('stat-pool-size');
    this.statRounds = document.getElementById('stat-rounds-count');

    // HUD Elements
    this.hudTargetName = document.getElementById('hud-target-name');
    this.hudIndexChip = document.getElementById('hud-index-chip');
    this.hudSpeedChip = document.getElementById('hud-speed-chip');
    this.hudModeText = document.getElementById('hud-mode-text');

    // Podium Elements
    this.podiumName = document.getElementById('podium-winner-name');
    this.podiumTime = document.getElementById('podium-winner-time');
    this.historyList = document.getElementById('history-list');
    this.historyCountBadge = document.getElementById('history-count-badge');

    // Modals
    this.winnerModal = document.getElementById('winner-modal');
    this.pasteModal = document.getElementById('paste-modal');
    this.bulkTextarea = document.getElementById('bulk-paste-textarea');
    this.pasteLineCount = document.getElementById('paste-line-count');

    // Theme State (Aligned with B-Forms: 'light' or 'dark')
    this.currentTheme = localStorage.getItem('bforms_theme') || 'light';
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.themeLabel = document.getElementById('theme-label');

    // Initialize Wheel Engine (Buildicy Theme Default)
    this.wheel = new WheelEngine(this.canvas, {
      theme: 'buildicy',
      themeMode: this.currentTheme,
      onSpinStart: () => this.handleSpinStart(),
      onSpinStep: (cand, speed) => this.handleSpinStep(cand, speed),
      onSpinEnd: (winner, index) => this.handleSpinEnd(winner, index),
      onPinTick: (speed) => this.handlePinTick(speed)
    });

    this.bindEvents();
    
    // Synchronize UI theme on load
    this.applyTheme(this.currentTheme, false);

    // Initialize with empty candidates pool awaiting user upload
    this.setCandidates([]);
  }

  bindEvents() {
    // Spin button click
    this.spinBtn.addEventListener('click', () => this.triggerSpin());

    // Spacebar hotkey to spin
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        this.triggerSpin();
      }
    });

    // Mobile navigation tabs
    const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
    mobileTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // Update active buttons
        mobileTabBtns.forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });

        // Switch panels
        const panels = document.querySelectorAll('.tab-panel');
        panels.forEach(p => {
          const match = p.id === `panel-${tabId}`;
          p.classList.toggle('active', match);
        });

        // Re-scale canvas when switching to wheel
        if (tabId === 'wheel') {
          setTimeout(() => this.wheel.setupCanvas(), 30);
        }
      });
    });

    // File Drag & Drop
    this.dropzone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('dragover');
    });

    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('dragover');
    });

    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.processFile(e.dataTransfer.files[0]);
      }
    });

    // Search filter
    this.searchInput.addEventListener('input', () => this.renderRosterList());

    // Duration slider
    this.durationSlider.addEventListener('input', () => {
      this.durationValLabel.textContent = `${this.durationSlider.value}s`;
    });

    // Roster batch action buttons
    document.getElementById('shuffle-btn').addEventListener('click', () => this.shuffleCandidates());
    document.getElementById('dedupe-btn').addEventListener('click', () => this.dedupeCandidates());
    document.getElementById('reset-pool-btn').addEventListener('click', () => this.resetPool());
    document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAllCandidates());

    // Theme Toggle (Light / Dark)
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Sound toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    soundBtn.addEventListener('click', () => this.toggleSound());

    // Fullscreen toggle
    document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());

    // Export & clear history
    document.getElementById('export-history-btn').addEventListener('click', () => this.exportHistoryCSV());
    document.getElementById('clear-history-btn').addEventListener('click', () => this.clearHistory());

    // Winner Modal buttons
    document.getElementById('winner-remove-btn').addEventListener('click', () => {
      this.removeWinnerAndClose();
    });

    document.getElementById('winner-keep-btn').addEventListener('click', () => {
      this.closeModal(this.winnerModal);
    });

    document.getElementById('winner-copy-btn').addEventListener('click', () => {
      if (this.currentWinner) {
        navigator.clipboard.writeText(this.currentWinner);
        const btn = document.getElementById('winner-copy-btn');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => {
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Name`;
        }, 1800);
      }
    });

    document.getElementById('close-winner-dialog-btn').addEventListener('click', () => {
      this.closeModal(this.winnerModal);
    });

    this.winnerModal.addEventListener('click', (e) => {
      const rect = this.winnerModal.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        this.closeModal(this.winnerModal);
      }
    });

    // Bulk Paste Modal buttons
    const openPasteBtn = document.getElementById('open-paste-modal-btn');
    openPasteBtn.addEventListener('click', () => {
      this.bulkTextarea.value = this.masterCandidates.join('\n');
      this.updatePasteCount();
      this.openModal(this.pasteModal);
    });

    document.getElementById('close-paste-dialog-btn').addEventListener('click', () => {
      this.closeModal(this.pasteModal);
    });

    this.pasteModal.addEventListener('click', (e) => {
      const rect = this.pasteModal.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        this.closeModal(this.pasteModal);
      }
    });

    this.bulkTextarea.addEventListener('input', () => this.updatePasteCount());

    document.getElementById('paste-sample-btn').addEventListener('click', () => {
      const sample = StudentImporter.generateRealisticStudents(500);
      this.bulkTextarea.value = sample.join('\n');
      this.updatePasteCount();
    });

    document.getElementById('paste-apply-btn').addEventListener('click', () => {
      const parsed = this.importer.parseRawInput(this.bulkTextarea.value);
      if (parsed.length > 0) {
        this.setCandidates(parsed);
        this.closeModal(this.pasteModal);
      } else {
        alert('Please enter at least one candidate name.');
      }
    });
  }

  async handleFileSelect(e) {
    if (e.target.files && e.target.files[0]) {
      await this.processFile(e.target.files[0]);
      e.target.value = '';
    }
  }

  async processFile(file) {
    try {
      this.hudTargetName.textContent = 'PARSING ROSTER...';
      const names = await this.importer.parseFile(file);
      if (names.length === 0) {
        alert(`No student names found in ${file.name}. Please ensure candidate names are present.`);
        this.hudTargetName.textContent = 'READY TO SPIN';
        return;
      }
      this.setCandidates(names);
      this.showToast(`Loaded ${names.length} candidates from ${file.name}`);
      
      // On mobile, auto-switch to wheel tab so they immediately see the rotator
      if (window.innerWidth < 1024) {
        this.switchMobileTab('wheel');
      }
    } catch (err) {
      console.error(err);
      alert(`Error reading file: ${err.message}`);
      this.hudTargetName.textContent = 'READY TO SPIN';
    }
  }

  loadPreset(count, notify = true) {
    const list = StudentImporter.generateRealisticStudents(count);
    this.setCandidates(list);
    if (notify) {
      this.showToast(`Loaded ${count} Buildicy candidates!`);
      if (window.innerWidth < 1024) {
        this.switchMobileTab('wheel');
      }
    }
  }

  switchMobileTab(tabId) {
    const btn = document.querySelector(`.mobile-tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  setCandidates(list) {
    this.masterCandidates = [...list];
    this.activeCandidates = [...list];
    this.wheel.setCandidates(this.activeCandidates);
    this.updateStats();
    this.renderRosterList();

    this.hudTargetName.textContent = 'READY TO SPIN';
    this.hudTargetName.classList.remove('flash-name');
    this.hudIndexChip.textContent = `INDEX: #-- / ${this.activeCandidates.length}`;
    this.hudSpeedChip.textContent = 'VELOCITY: 0 RPM';
    this.hudModeText.textContent = this.activeCandidates.length > 60 
      ? `QUANTUM MODE // ${this.activeCandidates.length} CANDIDATES ACTIVE`
      : `ORBIT MODE // ${this.activeCandidates.length} CANDIDATES ACTIVE`;
  }

  triggerSpin() {
    if (this.wheel.isSpinning) return;
    if (this.activeCandidates.length === 0) {
      alert('The candidate pool is empty! Reset pool or upload a student list.');
      return;
    }

    const duration = parseInt(this.durationSlider.value, 10);
    this.wheel.spin(duration);
  }

  handleSpinStart() {
    this.spinBtn.disabled = true;
    this.hudTargetName.classList.add('flash-name');
    this.hudModeText.textContent = 'BUILDICY HIGH-SPEED RADAR LOCK ACTIVE';
  }

  handleSpinStep(candidateInfo, speed) {
    if (!candidateInfo) return;

    const rpm = Math.round((Math.abs(speed) * 60) / (2 * Math.PI));

    this.hudTargetName.textContent = candidateInfo.name;
    this.hudIndexChip.textContent = `INDEX: #${candidateInfo.index + 1} / ${candidateInfo.total}`;
    this.hudSpeedChip.textContent = `VELOCITY: ${rpm} RPM`;
  }

  handlePinTick(speed) {
    // Acoustic & haptic feedback
  }

  handleSpinEnd(winner, index) {
    this.spinBtn.disabled = false;
    this.currentWinner = winner;
    this.roundsCount++;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    this.pickedHistory.unshift({
      name: winner,
      round: this.roundsCount,
      timestamp: timeStr
    });

    this.podiumName.textContent = winner;
    this.podiumTime.textContent = `Round #${this.roundsCount} at ${timeStr}`;

    document.getElementById('winner-modal-title').textContent = winner;
    document.getElementById('winner-meta-index').textContent = `Rank #${index + 1} of ${this.activeCandidates.length} students`;
    document.getElementById('winner-meta-time').textContent = timeStr;

    this.updateStats();
    this.renderHistory();

    if (this.autoRemoveCheckbox.checked) {
      document.getElementById('winner-remove-btn').textContent = 'Winner Auto-Removed (Click to Spin Next)';
      this.removeCandidateFromPool(winner, false);
    } else {
      document.getElementById('winner-remove-btn').textContent = 'Remove from Pool & Spin Next';
    }

    this.openModal(this.winnerModal);
  }

  removeWinnerAndClose() {
    if (this.currentWinner && !this.autoRemoveCheckbox.checked) {
      this.removeCandidateFromPool(this.currentWinner, true);
    }
    this.closeModal(this.winnerModal);
  }

  removeCandidateFromPool(name, updateWheel = true) {
    const idx = this.activeCandidates.indexOf(name);
    if (idx !== -1) {
      this.activeCandidates.splice(idx, 1);
      if (updateWheel) {
        this.wheel.setCandidates(this.activeCandidates);
      }
      this.updateStats();
      this.renderRosterList();
    }
  }

  resetPool() {
    this.activeCandidates = [...this.masterCandidates];
    this.wheel.setCandidates(this.activeCandidates);
    this.updateStats();
    this.renderRosterList();
    this.showToast('Pool restored to all loaded candidates');
  }

  shuffleCandidates() {
    if (this.activeCandidates.length < 2) {
      this.showToast(this.activeCandidates.length === 0 ? 'Upload candidates before shuffling' : 'Need at least 2 candidates to shuffle');
      return;
    }
    for (let i = this.activeCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.activeCandidates[i], this.activeCandidates[j]] = [this.activeCandidates[j], this.activeCandidates[i]];
    }
    this.wheel.setCandidates(this.activeCandidates);
    this.renderRosterList();
    this.showToast('Candidate order randomized around the wheel');
  }

  dedupeCandidates() {
    if (this.activeCandidates.length === 0) {
      this.showToast('Roster is empty - upload a list first');
      return;
    }
    const seen = new Set();
    const unique = [];
    for (const name of this.activeCandidates) {
      const trimmed = (name || '').trim();
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower) && trimmed.length > 0) {
        seen.add(lower);
        unique.push(trimmed);
      }
    }
    const diff = this.activeCandidates.length - unique.length;
    if (diff === 0) {
      this.showToast('All candidate names are unique (0 duplicates found)');
      return;
    }
    this.activeCandidates = unique;
    this.masterCandidates = [...unique];
    this.wheel.setCandidates(this.activeCandidates);
    this.updateStats();
    this.renderRosterList();
    this.showToast(`Cleaned & removed ${diff} duplicate student(s)`);
  }

  clearAllCandidates() {
    if (confirm('Clear all candidates from the wheel?')) {
      this.setCandidates([]);
      this.showToast('All candidates cleared');
    }
  }

  updateStats() {
    const total = this.masterCandidates.length;
    const pool = this.activeCandidates.length;
    const picked = total - pool;

    if (this.totalBadge) this.totalBadge.textContent = total;
    if (this.poolBadge) this.poolBadge.textContent = pool;
    if (this.pickedBadge) this.pickedBadge.textContent = picked;
    if (this.mobilePoolBadge) this.mobilePoolBadge.textContent = pool;
    if (this.mobileWonBadge) this.mobileWonBadge.textContent = this.pickedHistory.length;

    this.statPoolSize.textContent = `${pool} / ${total}`;
    this.statRounds.textContent = this.roundsCount;

    if (pool > 0) {
      const pct = (100 / pool).toFixed(2);
      this.statOdds.textContent = `1 in ${pool} (${pct}%)`;
    } else {
      this.statOdds.textContent = '0%';
    }

    this.historyCountBadge.textContent = `${this.pickedHistory.length} Won`;
  }

  renderRosterList() {
    const filter = this.searchInput.value.toLowerCase().trim();
    this.rosterList.innerHTML = '';

    const listToRender = this.masterCandidates.filter(name => {
      return !filter || name.toLowerCase().includes(filter);
    });

    if (listToRender.length === 0) {
      this.rosterList.innerHTML = `<div class="empty-history-msg">No matching candidates</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const maxRender = Math.min(listToRender.length, 120);

    for (let i = 0; i < maxRender; i++) {
      const name = listToRender[i];
      const isPicked = !this.activeCandidates.includes(name);

      const card = document.createElement('div');
      card.className = `candidate-item-card ${isPicked ? 'is-picked' : ''}`;

      card.innerHTML = `
        <div class="item-left">
          <span class="item-index">#${i + 1}</span>
          <span class="item-name" title="${name}">${this.escapeHtml(name)}</span>
        </div>
        <button class="item-remove-btn" title="Remove student" aria-label="Remove ${this.escapeHtml(name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      card.querySelector('.item-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.masterCandidates = this.masterCandidates.filter(c => c !== name);
        this.removeCandidateFromPool(name, true);
      });

      fragment.appendChild(card);
    }

    if (listToRender.length > maxRender) {
      const moreCard = document.createElement('div');
      moreCard.className = 'empty-history-msg';
      moreCard.textContent = `+ ${listToRender.length - maxRender} more candidates in memory`;
      fragment.appendChild(moreCard);
    }

    this.rosterList.appendChild(fragment);
  }

  renderHistory() {
    this.historyList.innerHTML = '';
    if (this.pickedHistory.length === 0) {
      this.historyList.innerHTML = `<div class="empty-history-msg">Selected students will appear here chronologically.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.pickedHistory.forEach(item => {
      const row = document.createElement('div');
      row.className = 'history-item-row';
      row.innerHTML = `
        <span class="history-round">#${item.round}</span>
        <span class="history-name" title="${item.name}">${this.escapeHtml(item.name)}</span>
        <span class="history-time">${item.timestamp}</span>
      `;
      fragment.appendChild(row);
    });

    this.historyList.appendChild(fragment);
  }

  exportHistoryCSV() {
    if (this.pickedHistory.length === 0) {
      alert('No winners recorded yet to export.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,Round,Candidate Name,Timestamp\n';
    this.pickedHistory.forEach(h => {
      csvContent += `"${h.round}","${h.name.replace(/"/g, '""')}","${h.timestamp}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `buildicy_wheel_winners_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  clearHistory() {
    if (confirm('Clear the winner history log?')) {
      this.pickedHistory = [];
      this.roundsCount = 0;
      this.renderHistory();
      this.updateStats();
      this.showToast('Winner history cleared');
    }
  }

  toggleSound() {
    this.soundMuted = !this.soundMuted;
    this.wheel.audioEngine.setMuted(this.soundMuted);

    const onIcon = document.querySelector('.sound-on-icon');
    const offIcon = document.querySelector('.sound-off-icon');

    if (this.soundMuted) {
      onIcon.classList.add('hidden');
      offIcon.classList.remove('hidden');
      this.showToast('Sound Muted');
    } else {
      onIcon.classList.remove('hidden');
      offIcon.classList.add('hidden');
      this.showToast('Sound Enabled');
    }
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme, true);
  }

  applyTheme(theme, showToast = false) {
    this.currentTheme = theme;
    try {
      localStorage.setItem('bforms_theme', theme);
    } catch (e) {}

    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light', isLight);
    document.documentElement.classList.toggle('dark', !isLight);
    document.body.classList.toggle('light', isLight);
    document.body.classList.toggle('dark', !isLight);

    // Update button icons & text
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    if (sunIcon && moonIcon) {
      if (isLight) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      }
    }

    if (this.themeLabel) {
      this.themeLabel.textContent = isLight ? 'Light' : 'Dark';
    }

    // Reactively update wheel canvas rendering colors & shading
    if (this.wheel) {
      this.wheel.setThemeMode(theme);
    }

    if (showToast) {
      this.showToast(isLight ? 'Switched to Light Theme' : 'Switched to Dark Obsidian Theme');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  openModal(dialog) {
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }

  closeModal(dialog) {
    if (dialog && typeof dialog.close === 'function') {
      dialog.close();
    }
  }

  updatePasteCount() {
    const text = this.bulkTextarea.value.trim();
    if (!text) {
      this.pasteLineCount.textContent = '0 candidates detected';
      return;
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    this.pasteLineCount.textContent = `${lines.length} candidate(s) detected`;
  }

  showToast(msg) {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 18, 28, 0.95);
      border: 1px solid var(--accent-purple);
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 25px rgba(124,58,237,0.4);
      z-index: 10000;
      pointer-events: none;
      animation: toastFade 2.4s forwards;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new StudentWheelApp();
});
