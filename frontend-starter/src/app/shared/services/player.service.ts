import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Track } from '../models/track.model';

export type EQPreset = 'flat' | 'bass-boost' | 'vocal' | 'electronic' | 'custom';

@Injectable({
  providedIn: 'root',
})
export class PlayerService implements OnDestroy {
  private readonly auth = inject(AuthService);

  private audio?: HTMLAudioElement;
  private audioCtx?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;
  private pannerNode?: StereoPannerNode;

  // Filtres Égaliseur 3 bandes
  private lowFilter?: BiquadFilterNode;
  private midFilter?: BiquadFilterNode;
  private highFilter?: BiquadFilterNode;

  // Analyseur principal (FFT) et analyseurs stéréo (VU-mètres L/R)
  private analyserNode?: AnalyserNode;
  private splitterNode?: ChannelSplitterNode;
  private analyserLeft?: AnalyserNode;
  private analyserRight?: AnalyserNode;

  private isSourceConnected = false;
  private leftPeak = 0;
  private rightPeak = 0;

  // Signaux d'état du lecteur
  readonly currentTrack = signal<Track | null>(null);
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly progress = signal(0);
  readonly volume = signal(0.8);
  readonly isMuted = signal(false);
  private previousVolume = 0.8;
  readonly balance = signal(0);
  readonly isLoading = signal(false);
  readonly isSeeking = signal(false);
  readonly error = signal<string | null>(null);

  // Signaux d'égaliseur (en dB de -12 à +12)
  readonly bass = signal(0);
  readonly mid = signal(0);
  readonly treble = signal(0);
  readonly currentPreset = signal<EQPreset>('flat');

  // File d'attente (Queue), Shuffle et Répétition
  readonly queue = signal<Track[]>([]);
  readonly isShuffle = signal(false);
  readonly repeatMode = signal<'none' | 'one' | 'all'>('none');
  readonly history = signal<Track[]>([]);

  // Signal dérivé pour formater le temps actuel et la durée
  readonly formattedCurrentTime = computed(() => this.formatTime(this.currentTime()));
  readonly formattedDuration = computed(() => this.formatTime(this.duration()));

  constructor() {
    this.loadEQFromStorage();
    this.initAudio();
  }

  ngOnDestroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
  }

  private initAudio(): void {
    if (typeof window === 'undefined') return;

    if (typeof Audio !== 'undefined') {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';
      this.audio.preload = 'metadata';
      this.setupAudioListeners();
    }
  }

  private initWebAudio(): void {
    if (this.audioCtx || typeof window === 'undefined') return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    try {
      this.audioCtx = new AudioContextClass();

      // 1. Filtres égaliseur 3 bandes
      this.lowFilter = this.audioCtx.createBiquadFilter();
      this.lowFilter.type = 'lowshelf';
      this.lowFilter.frequency.value = 100;
      this.lowFilter.gain.value = this.bass();

      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1;
      this.midFilter.gain.value = this.mid();

      this.highFilter = this.audioCtx.createBiquadFilter();
      this.highFilter.type = 'highshelf';
      this.highFilter.frequency.value = 8000;
      this.highFilter.gain.value = this.treble();

      // 2. Noeud de Gain pour le volume
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.volume();

      // 3. Panner stéréo pour la balance G/D
      if (typeof this.audioCtx.createStereoPanner === 'function') {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.pan.value = this.balance();
      }

      // 4. Noeud d'Analyse principal pour le spectre FFT
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 5. Splitter pour séparer les canaux Gauche / Droite (VU-mètres stéréo)
      this.splitterNode = this.audioCtx.createChannelSplitter(2);

      this.analyserLeft = this.audioCtx.createAnalyser();
      this.analyserLeft.fftSize = 256;
      this.analyserLeft.smoothingTimeConstant = 0.5;

      this.analyserRight = this.audioCtx.createAnalyser();
      this.analyserRight.fftSize = 256;
      this.analyserRight.smoothingTimeConstant = 0.5;

      this.connectNodes();
    } catch (e) {
      console.warn('[PlayerService] Impossible d\'initialiser le contexte Web Audio:', e);
    }
  }

  private connectNodes(): void {
    if (!this.audio || !this.audioCtx || !this.gainNode || !this.analyserNode) return;

    try {
      if (!this.isSourceConnected) {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
        this.isSourceConnected = true;
      }

      if (this.sourceNode) {
        this.sourceNode.disconnect();

        // Chaîne principale : source -> lowFilter -> midFilter -> highFilter -> gainNode -> panner -> destination
        let lastNode: AudioNode = this.sourceNode;

        if (this.lowFilter && this.midFilter && this.highFilter) {
          lastNode.connect(this.lowFilter);
          this.lowFilter.connect(this.midFilter);
          this.midFilter.connect(this.highFilter);
          this.highFilter.connect(this.gainNode);
          lastNode = this.gainNode;
        } else {
          lastNode.connect(this.gainNode);
          lastNode = this.gainNode;
        }

        if (this.pannerNode) {
          lastNode.connect(this.pannerNode);
          lastNode = this.pannerNode;
        }

        // Sortie audio vers haut-parleurs
        lastNode.connect(this.audioCtx.destination);

        // Dérivation vers le visualiseur de fréquences FFT
        if (this.analyserNode) {
          lastNode.connect(this.analyserNode);
        }

        // Dérivation vers les VU-mètres stéréo séparés
        if (this.splitterNode && this.analyserLeft && this.analyserRight) {
          lastNode.connect(this.splitterNode);
          this.splitterNode.connect(this.analyserLeft, 0);
          this.splitterNode.connect(this.analyserRight, 1);
        }
      }
    } catch (e) {
      console.warn('[PlayerService] Erreur lors de la connexion des noeuds Web Audio:', e);
    }
  }

  private setupAudioListeners(): void {
    if (!this.audio) return;

    this.audio.addEventListener('play', () => {
      this.isPlaying.set(true);
      this.isLoading.set(false);
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying.set(false);
    });

    this.audio.addEventListener('waiting', () => {
      this.isLoading.set(true);
    });

    this.audio.addEventListener('playing', () => {
      this.isLoading.set(false);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio?.duration || 0;
      this.duration.set(isFinite(dur) ? dur : 0);
      this.isLoading.set(false);
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking() && this.audio) {
        const cur = this.audio.currentTime || 0;
        const dur = this.duration();
        this.currentTime.set(cur);
        this.progress.set(dur > 0 ? (cur / dur) * 100 : 0);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.repeatMode() === 'one') {
        if (this.audio) {
          this.audio.currentTime = 0;
          void this.audio.play();
        }
      } else if (this.queue().length > 0 || (this.repeatMode() === 'all' && this.history().length > 0)) {
        void this.playNext();
      } else {
        this.isPlaying.set(false);
        this.currentTime.set(0);
        this.progress.set(0);
      }
    });

    this.audio.addEventListener('error', () => {
      const audioErr = this.audio?.error;
      console.error('[PlayerService] Erreur de lecture audio:', audioErr);
      this.error.set('Impossible de charger le flux audio (erreur de lecture ou réseau).');
      this.isLoading.set(false);
      this.isPlaying.set(false);
    });
  }

  async resumeContext(): Promise<void> {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('[PlayerService] Échec de la reprise du contexte Audio:', err);
      }
    }
  }

  async playTrack(track: Track): Promise<void> {
    if (!this.audio) {
      this.initAudio();
    }
    await this.resumeContext();

    const previous = this.currentTrack();
    if (previous && previous.id !== track.id) {
      this.history.update((h) => [...h, previous]);
    }

    this.error.set(null);
    this.isLoading.set(true);
    this.currentTrack.set(track);

    const token = this.auth.token();
    const audioUrl = token
      ? `/api/tracks/${track.id}/audio?token=${encodeURIComponent(token)}`
      : `/api/tracks/${track.id}/audio`;

    if (this.audio) {
      this.audio.src = audioUrl;
      this.audio.load();
      try {
        await this.audio.play();
      } catch (e) {
        console.error('[PlayerService] Erreur lors de audio.play():', e);
        this.isLoading.set(false);
      }
    }
  }

  // --- Gestion de la file d'attente (Queue) et navigation ---

  addToQueue(track: Track): void {
    this.queue.update((q) => [...q, track]);
  }

  addMultipleToQueue(tracks: Track[]): void {
    this.queue.update((q) => [...q, ...tracks]);
  }

  removeFromQueue(index: number): void {
    this.queue.update((q) => q.filter((_, i) => i !== index));
  }

  clearQueue(): void {
    this.queue.set([]);
  }

  async playNext(): Promise<void> {
    const currentQ = this.queue();
    if (currentQ.length > 0) {
      let nextIndex = 0;
      if (this.isShuffle()) {
        nextIndex = Math.floor(Math.random() * currentQ.length);
      }
      const nextTrack = currentQ[nextIndex];
      this.queue.set(currentQ.filter((_, i) => i !== nextIndex));
      await this.playTrack(nextTrack);
    } else if (this.repeatMode() === 'all' && this.history().length > 0) {
      // Reboucler sur la liste d'historique
      const allTracks = [...this.history()];
      const current = this.currentTrack();
      if (current) {
        allTracks.push(current);
      }
      const first = allTracks.shift()!;
      this.queue.set(allTracks);
      this.history.set([]);
      await this.playTrack(first);
    } else {
      this.isPlaying.set(false);
      this.currentTime.set(0);
      this.progress.set(0);
    }
  }

  async playPrevious(): Promise<void> {
    // Si la piste est entamée depuis plus de 3s, on recommence la piste
    if (this.currentTime() > 3) {
      this.seekPercent(0);
      if (this.audio) {
        this.audio.currentTime = 0;
      }
      return;
    }

    const hist = this.history();
    if (hist.length > 0) {
      const prevTrack = hist[hist.length - 1];
      this.history.set(hist.slice(0, -1));
      const current = this.currentTrack();
      if (current) {
        this.queue.update((q) => [current, ...q]);
      }
      await this.playTrack(prevTrack);
    } else {
      this.seekPercent(0);
      if (this.audio) {
        this.audio.currentTime = 0;
      }
    }
  }

  toggleShuffle(): void {
    this.isShuffle.update((s) => !s);
  }

  toggleRepeat(): void {
    const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
    const current = this.repeatMode();
    const nextIndex = (modes.indexOf(current) + 1) % modes.length;
    this.repeatMode.set(modes[nextIndex]);
  }

  async togglePlay(): Promise<void> {
    if (!this.currentTrack() || !this.audio) return;

    await this.resumeContext();

    if (this.isPlaying()) {
      this.audio.pause();
    } else {
      try {
        await this.audio.play();
      } catch (e) {
        console.error('[PlayerService] Erreur togglePlay:', e);
      }
    }
  }

  async play(): Promise<void> {
    if (!this.audio) return;
    await this.resumeContext();
    try {
      await this.audio.play();
    } catch (e) {
      console.error('[PlayerService] Erreur play:', e);
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.progress.set(0);
    this.currentTrack.set(null);
  }

  startSeeking(): void {
    this.isSeeking.set(true);
  }

  seekPercent(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    const targetTime = (clamped / 100) * this.duration();
    this.progress.set(clamped);
    this.currentTime.set(targetTime);
  }

  endSeeking(percent?: number): void {
    if (percent !== undefined) {
      this.seekPercent(percent);
    }
    if (this.audio && isFinite(this.currentTime())) {
      this.audio.currentTime = this.currentTime();
    }
    this.isSeeking.set(false);
  }

  setVolume(newVolume: number): void {
    const clamped = Math.max(0, Math.min(1, newVolume));
    this.volume.set(clamped);
    this.isMuted.set(clamped === 0);

    if (this.audio) {
      this.audio.volume = clamped;
    }
    if (this.gainNode) {
      this.gainNode.gain.value = clamped;
    }
  }

  toggleMute(): void {
    if (this.isMuted()) {
      this.setVolume(this.previousVolume > 0 ? this.previousVolume : 0.8);
    } else {
      this.previousVolume = this.volume();
      this.setVolume(0);
    }
  }

  setBalance(newBalance: number): void {
    const clamped = Math.max(-1, Math.min(1, newBalance));
    this.balance.set(clamped);
    if (this.pannerNode) {
      this.pannerNode.pan.value = clamped;
    }
  }

  // --- Gestion de l'Égaliseur (EQ 3 bandes) ---
  setBass(db: number): void {
    const clamped = Math.max(-12, Math.min(12, db));
    this.bass.set(clamped);
    if (this.lowFilter) {
      this.lowFilter.gain.value = clamped;
    }
    this.currentPreset.set('custom');
    this.saveEQToStorage();
  }

  setMid(db: number): void {
    const clamped = Math.max(-12, Math.min(12, db));
    this.mid.set(clamped);
    if (this.midFilter) {
      this.midFilter.gain.value = clamped;
    }
    this.currentPreset.set('custom');
    this.saveEQToStorage();
  }

  setTreble(db: number): void {
    const clamped = Math.max(-12, Math.min(12, db));
    this.treble.set(clamped);
    if (this.highFilter) {
      this.highFilter.gain.value = clamped;
    }
    this.currentPreset.set('custom');
    this.saveEQToStorage();
  }

  setPreset(name: 'flat' | 'bass-boost' | 'vocal' | 'electronic'): void {
    const presets: Record<string, { bass: number; mid: number; treble: number }> = {
      flat: { bass: 0, mid: 0, treble: 0 },
      'bass-boost': { bass: 7, mid: 0, treble: -1 },
      vocal: { bass: -2, mid: 6, treble: 3 },
      electronic: { bass: 5, mid: -1, treble: 5 },
    };

    const target = presets[name] || presets['flat'];
    this.bass.set(target.bass);
    this.mid.set(target.mid);
    this.treble.set(target.treble);

    if (this.lowFilter) this.lowFilter.gain.value = target.bass;
    if (this.midFilter) this.midFilter.gain.value = target.mid;
    if (this.highFilter) this.highFilter.gain.value = target.treble;

    this.currentPreset.set(name);
    this.saveEQToStorage();
  }

  resetEQ(): void {
    this.setPreset('flat');
  }

  private saveEQToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = {
        bass: this.bass(),
        mid: this.mid(),
        treble: this.treble(),
        preset: this.currentPreset(),
      };
      localStorage.setItem('from_zero_eq', JSON.stringify(data));
    } catch {
      // Ignorer si stockage inaccessible
    }
  }

  private loadEQFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('from_zero_eq');
      if (stored) {
        const data = JSON.parse(stored);
        if (typeof data.bass === 'number') this.bass.set(data.bass);
        if (typeof data.mid === 'number') this.mid.set(data.mid);
        if (typeof data.treble === 'number') this.treble.set(data.treble);
        if (data.preset) this.currentPreset.set(data.preset);
      }
    } catch {
      // Ignorer si parsing invalide
    }
  }

  // --- Données d'analyse et VU-mètres Stéréo ---
  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyserNode.fftSize);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  getStereoVULevels(): { left: number; right: number; leftPeak: number; rightPeak: number } {
    if (!this.analyserLeft || !this.analyserRight || !this.isPlaying()) {
      return { left: 0, right: 0, leftPeak: 0, rightPeak: 0 };
    }

    const leftLevel = this.computeRMS(this.analyserLeft);
    const rightLevel = this.computeRMS(this.analyserRight);

    if (leftLevel > this.leftPeak) this.leftPeak = leftLevel;
    else this.leftPeak = Math.max(0, this.leftPeak - 0.02);

    if (rightLevel > this.rightPeak) this.rightPeak = rightLevel;
    else this.rightPeak = Math.max(0, this.rightPeak - 0.02);

    return {
      left: leftLevel,
      right: rightLevel,
      leftPeak: this.leftPeak,
      rightPeak: this.rightPeak,
    };
  }

  private computeRMS(analyser: AnalyserNode): number {
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const val = (buffer[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / buffer.length);
    return Math.min(1, rms * 2.8);
  }

  getAudioContext(): AudioContext | undefined {
    return this.audioCtx;
  }

  getAnalyserNode(): AnalyserNode | undefined {
    return this.analyserNode;
  }

  getGainNode(): GainNode | undefined {
    return this.gainNode;
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
