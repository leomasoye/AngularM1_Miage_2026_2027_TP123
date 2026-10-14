import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Track } from '../models/track.model';

@Injectable({
  providedIn: 'root',
})
export class PlayerService implements OnDestroy {
  private readonly auth = inject(AuthService);

  private audio?: HTMLAudioElement;
  private audioCtx?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;
  private analyserNode?: AnalyserNode;
  private pannerNode?: StereoPannerNode;
  private isSourceConnected = false;

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

  // Signal dérivé pour formater le temps actuel et la durée
  readonly formattedCurrentTime = computed(() => this.formatTime(this.currentTime()));
  readonly formattedDuration = computed(() => this.formatTime(this.duration()));

  constructor() {
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

      // Noeud de Gain pour le volume
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.volume();

      // Noeud d'Analyse pour VU-mètres et spectres
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Panner stéréo pour la balance G/D
      if (typeof this.audioCtx.createStereoPanner === 'function') {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.pan.value = this.balance();
      }

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

      // Chaîne audio: source -> gain -> analyser -> (panner) -> destination
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);

        if (this.pannerNode) {
          this.analyserNode.connect(this.pannerNode);
          this.pannerNode.connect(this.audioCtx.destination);
        } else {
          this.analyserNode.connect(this.audioCtx.destination);
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
      this.isPlaying.set(false);
      this.currentTime.set(0);
      this.progress.set(0);
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
