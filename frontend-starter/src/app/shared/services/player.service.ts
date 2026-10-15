import { computed, inject, Injectable, NgZone, OnDestroy, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Track } from '../models/track.model';

export type EQPreset = 'flat' | 'bass-boost' | 'vocal' | 'electronic' | 'custom';
export type SpatialPreset = 'none' | 'room' | 'hall' | 'stadium' | 'space-echo' | 'custom';

@Injectable({
  providedIn: 'root',
})
export class PlayerService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly ngZone = inject(NgZone);

  private audio?: HTMLAudioElement;
  private audioCtx?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private gainNode?: GainNode;
  private pannerNode?: StereoPannerNode;

  // Filtres Égaliseur 3 bandes
  private lowFilter?: BiquadFilterNode;
  private midFilter?: BiquadFilterNode;
  private highFilter?: BiquadFilterNode;

  // Effets Spatiaux (Étape 9 : Reverb Convolver & Delay Écho)
  private convolverNode?: ConvolverNode;
  private reverbGainNode?: GainNode;
  private delayNode?: DelayNode;
  private delayFeedbackNode?: GainNode;
  private delayGainNode?: GainNode;
  private dryGainNode?: GainNode;
  private effectsMixBus?: GainNode;

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

  // Signaux d'effets spatiaux (Étape 9)
  readonly reverbWet = signal(0); // 0 à 1
  readonly delayTime = signal(0.3); // 0.05 à 1.0s
  readonly delayFeedback = signal(0); // 0 à 0.8
  readonly spatialPreset = signal<SpatialPreset>('none');

  // File d'attente (Queue), Shuffle et Répétition
  readonly queue = signal<Track[]>([]);
  readonly isShuffle = signal(false);
  readonly repeatMode = signal<'none' | 'one' | 'all'>('none');
  readonly history = signal<Track[]>([]);

  // Waveform décodée (Étape 8)
  readonly waveformPeaks = signal<number[]>([]);
  readonly isWaveformLoading = signal<boolean>(false);
  private waveformCache = new Map<string, number[]>();
  private currentDecodeAbortController?: AbortController;

  // Signal dérivé pour formater le temps actuel et la durée
  readonly formattedCurrentTime = computed(() => this.formatTime(this.currentTime()));
  readonly formattedDuration = computed(() => this.formatTime(this.duration()));

  constructor() {
    this.loadEQFromStorage();
    this.loadSpatialFromStorage();
    this.initAudio();
  }

  ngOnDestroy(): void {
    if (this.currentDecodeAbortController) {
      this.currentDecodeAbortController.abort();
    }
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
      this.ngZone.runOutsideAngular(() => {
        this.setupAudioListeners();
      });
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

      // 1. Filtres égaliseur 3 bandes (Basses percutantes 150 Hz et Aigus cristallins 6 kHz)
      this.lowFilter = this.audioCtx.createBiquadFilter();
      this.lowFilter.type = 'lowshelf';
      this.lowFilter.frequency.value = 150;
      this.lowFilter.gain.value = this.bass();

      this.midFilter = this.audioCtx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1;
      this.midFilter.gain.value = this.mid();

      this.highFilter = this.audioCtx.createBiquadFilter();
      this.highFilter.type = 'highshelf';
      this.highFilter.frequency.value = 6000;
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

      // 6. Effets Spatiaux (Étape 9 : Reverb Convolver & Delay Écho)
      if (typeof this.audioCtx.createConvolver === 'function') {
        this.convolverNode = this.audioCtx.createConvolver();
        const impulse = this.createImpulseResponse(2.5, 2.0);
        if (impulse) {
          this.convolverNode.buffer = impulse;
        }
      }

      this.reverbGainNode = this.audioCtx.createGain();
      this.reverbGainNode.gain.value = this.reverbWet();

      if (typeof this.audioCtx.createDelay === 'function') {
        this.delayNode = this.audioCtx.createDelay(2.0);
        this.delayNode.delayTime.value = this.delayTime();
      }

      this.delayFeedbackNode = this.audioCtx.createGain();
      this.delayFeedbackNode.gain.value = Math.min(0.8, this.delayFeedback());

      this.delayGainNode = this.audioCtx.createGain();
      this.delayGainNode.gain.value = this.delayFeedback() > 0 ? 0.75 : 0;

      this.dryGainNode = this.audioCtx.createGain();
      this.dryGainNode.gain.value = 1.0;

      this.effectsMixBus = this.audioCtx.createGain();
      this.effectsMixBus.gain.value = 1.0;

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

        // 1. Filtres EQ 3 bandes
        let eqOutput: AudioNode = this.sourceNode;
        if (this.lowFilter && this.midFilter && this.highFilter) {
          this.sourceNode.connect(this.lowFilter);
          this.lowFilter.connect(this.midFilter);
          this.midFilter.connect(this.highFilter);
          eqOutput = this.highFilter;
        }

        // 2. Section Effets Spatiaux (Dry + Reverb + Delay) vers effectsMixBus
        if (this.effectsMixBus && this.dryGainNode) {
          // Voie Directe (Dry)
          eqOutput.connect(this.dryGainNode);
          this.dryGainNode.connect(this.effectsMixBus);

          // Voie Réverbération (Convolver)
          if (this.convolverNode && this.reverbGainNode) {
            eqOutput.connect(this.convolverNode);
            this.convolverNode.connect(this.reverbGainNode);
            this.reverbGainNode.connect(this.effectsMixBus);
          }

          // Voie Delay (Écho avec boucle de feedback)
          if (this.delayNode && this.delayFeedbackNode && this.delayGainNode) {
            eqOutput.connect(this.delayNode);
            // Boucle de feedback
            this.delayNode.connect(this.delayFeedbackNode);
            this.delayFeedbackNode.connect(this.delayNode);
            // Sortie vers le bus de mix
            this.delayNode.connect(this.delayGainNode);
            this.delayGainNode.connect(this.effectsMixBus);
          }

          this.effectsMixBus.connect(this.gainNode);
        } else {
          eqOutput.connect(this.gainNode);
        }

        let lastNode: AudioNode = this.gainNode;

        if (this.pannerNode) {
          this.gainNode.connect(this.pannerNode);
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

    // Décodage asynchrone de la forme d'onde
    void this.loadWaveform(track);

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

  /**
   * Récupère le flux audio complet, le décode via AudioContext.decodeAudioData
   * et extrait 120 crêtes normalisées pour la forme d'onde interactive.
   */
  async loadWaveform(track: Track): Promise<number[]> {
    if (this.waveformCache.has(track.id)) {
      const cached = this.waveformCache.get(track.id)!;
      this.waveformPeaks.set(cached);
      this.isWaveformLoading.set(false);
      return cached;
    }

    this.waveformPeaks.set([]);
    this.isWaveformLoading.set(true);

    if (this.currentDecodeAbortController) {
      this.currentDecodeAbortController.abort();
    }
    const abortController = new AbortController();
    this.currentDecodeAbortController = abortController;

    try {
      const token = this.auth.token();
      const baseAudioUrl = token
        ? `/api/tracks/${track.id}/audio?token=${encodeURIComponent(token)}`
        : `/api/tracks/${track.id}/audio`;
      const delimiter = baseAudioUrl.includes('?') ? '&' : '?';
      const waveformUrl = `${baseAudioUrl}${delimiter}waveform=1`;

      const response = await fetch(waveformUrl, { signal: abortController.signal });
      if (!response.ok) {
        throw new Error(`Erreur HTTP lors du téléchargement pour analyse: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();

      if (!this.audioCtx) {
        this.initWebAudio();
      }

      if (!this.audioCtx || typeof this.audioCtx.decodeAudioData !== 'function') {
        throw new Error('Web Audio decodeAudioData non disponible');
      }

      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        let resolved = false;
        try {
          const res = this.audioCtx!.decodeAudioData(
            arrayBuffer,
            (buf) => {
              if (!resolved) {
                resolved = true;
                resolve(buf);
              }
            },
            (err) => {
              if (!resolved) {
                resolved = true;
                reject(err);
              }
            }
          );
          if (res && typeof (res as Promise<AudioBuffer>).then === 'function') {
            (res as Promise<AudioBuffer>).then(
              (buf) => {
                if (!resolved) {
                  resolved = true;
                  resolve(buf);
                }
              },
              (err) => {
                if (!resolved) {
                  resolved = true;
                  reject(err);
                }
              }
            );
          }
        } catch (e) {
          reject(e);
        }
      });

      const peaks = this.extractPeaks(audioBuffer, 120);
      this.waveformCache.set(track.id, peaks);

      if (this.currentTrack()?.id === track.id) {
        this.waveformPeaks.set(peaks);
        this.isWaveformLoading.set(false);
      }
      return peaks;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return [];
      }

      // Fallback esthétique (onde harmonique fluide) pour un rendu visuel impeccable
      const fallback = this.generateFallbackPeaks(120);
      this.waveformCache.set(track.id, fallback);
      if (this.currentTrack()?.id === track.id) {
        this.waveformPeaks.set(fallback);
        this.isWaveformLoading.set(false);
      }
      return fallback;
    }
  }

  /**
   * Extrait N crêtes normalisées (entre 0.08 et 1.0) à partir d'un AudioBuffer.
   */
  extractPeaks(audioBuffer: AudioBuffer, totalBars = 120): number[] {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const blockSize = Math.floor(length / totalBars);
    if (blockSize <= 0) return new Array(totalBars).fill(0.2);

    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = channels > 1 ? audioBuffer.getChannelData(1) : null;

    const peaks: number[] = new Array(totalBars);
    let maxPeak = 0;

    // Pas d'échantillonnage pour décoder instantanément même sur de longs fichiers
    const sampleStep = Math.max(1, Math.floor(blockSize / 100));

    for (let bar = 0; bar < totalBars; bar++) {
      let maxVal = 0;
      const start = bar * blockSize;
      const end = Math.min(start + blockSize, length);

      for (let i = start; i < end; i += sampleStep) {
        let sample = Math.abs(ch0[i]);
        if (ch1) {
          sample = (sample + Math.abs(ch1[i])) * 0.5;
        }
        if (sample > maxVal) {
          maxVal = sample;
        }
      }
      peaks[bar] = maxVal;
      if (maxVal > maxPeak) {
        maxPeak = maxVal;
      }
    }

    const normFactor = maxPeak > 0 ? 1 / maxPeak : 1;
    for (let bar = 0; bar < totalBars; bar++) {
      const normalized = peaks[bar] * normFactor;
      peaks[bar] = Math.max(0.08, Math.min(1.0, Number(normalized.toFixed(3))));
    }

    return peaks;
  }

  /**
   * Crée des crêtes harmoniques naturelles en cas d'impossibilité de décodage réseau/buffer.
   */
  generateFallbackPeaks(totalBars = 120): number[] {
    const peaks: number[] = [];
    for (let i = 0; i < totalBars; i++) {
      const t = i / totalBars;
      const wave1 = Math.sin(t * Math.PI);
      const wave2 = Math.sin(t * 7 * Math.PI) * 0.25;
      const wave3 = Math.cos(t * 13 * Math.PI) * 0.15;
      const val = 0.35 + 0.35 * wave1 + wave2 + wave3;
      peaks.push(Math.max(0.1, Math.min(0.95, Number(val.toFixed(3)))));
    }
    return peaks;
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
    if (this.currentDecodeAbortController) {
      this.currentDecodeAbortController.abort();
    }
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.progress.set(0);
    this.currentTrack.set(null);
    this.waveformPeaks.set([]);
    this.isWaveformLoading.set(false);
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

  // --- Gestion de l'Égaliseur (EQ 3 bandes avec plage étendue [-24 dB, +24 dB]) ---
  setBass(db: number): void {
    const clamped = Math.max(-24, Math.min(24, db));
    this.bass.set(clamped);
    if (this.lowFilter) {
      this.lowFilter.gain.value = clamped;
    }
    this.currentPreset.set('custom');
    this.saveEQToStorage();
  }

  setMid(db: number): void {
    const clamped = Math.max(-24, Math.min(24, db));
    this.mid.set(clamped);
    if (this.midFilter) {
      this.midFilter.gain.value = clamped;
    }
    this.currentPreset.set('custom');
    this.saveEQToStorage();
  }

  setTreble(db: number): void {
    const clamped = Math.max(-24, Math.min(24, db));
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
      'bass-boost': { bass: 14, mid: 1, treble: -2 },
      vocal: { bass: -4, mid: 8, treble: 5 },
      electronic: { bass: 12, mid: -2, treble: 8 },
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

  // --- Gestion des Effets Spatiaux (Reverb & Delay - Étape 9) ---

  createImpulseResponse(duration = 2.5, decay = 2.0): AudioBuffer | undefined {
    if (!this.audioCtx || typeof this.audioCtx.createBuffer !== 'function') return undefined;
    try {
      const rate = this.audioCtx.sampleRate || 44100;
      const length = Math.max(1, Math.floor(rate * duration));
      const impulse = this.audioCtx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / length;
        const envelope = Math.pow(1 - t, decay);
        left[i] = (Math.random() * 2 - 1) * envelope;
        right[i] = (Math.random() * 2 - 1) * envelope;
      }
      return impulse;
    } catch (e) {
      console.warn('[PlayerService] Erreur création de réponse impulsionnelle:', e);
      return undefined;
    }
  }

  setReverbWet(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.reverbWet.set(clamped);
    if (this.reverbGainNode && this.audioCtx) {
      try {
        if (
          typeof this.reverbGainNode.gain.setTargetAtTime === 'function' &&
          typeof this.audioCtx.currentTime === 'number'
        ) {
          this.reverbGainNode.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.03);
        } else {
          this.reverbGainNode.gain.value = clamped;
        }
      } catch {
        this.reverbGainNode.gain.value = clamped;
      }
    }
    this.saveSpatialToStorage();
  }

  setDelayTime(seconds: number): void {
    const clamped = Math.max(0.05, Math.min(1.0, seconds));
    this.delayTime.set(clamped);
    if (this.delayNode && this.audioCtx) {
      try {
        if (
          typeof this.delayNode.delayTime.setTargetAtTime === 'function' &&
          typeof this.audioCtx.currentTime === 'number'
        ) {
          this.delayNode.delayTime.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.03);
        } else {
          this.delayNode.delayTime.value = clamped;
        }
      } catch {
        this.delayNode.delayTime.value = clamped;
      }
    }
    this.saveSpatialToStorage();
  }

  setDelayFeedback(feedback: number): void {
    const clamped = Math.max(0, Math.min(0.8, feedback));
    this.delayFeedback.set(clamped);
    if (this.delayFeedbackNode && this.delayGainNode && this.audioCtx) {
      try {
        const delayWet = clamped > 0 ? 0.75 : 0;
        if (
          typeof this.delayFeedbackNode.gain.setTargetAtTime === 'function' &&
          typeof this.audioCtx.currentTime === 'number'
        ) {
          this.delayFeedbackNode.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.03);
          this.delayGainNode.gain.setTargetAtTime(delayWet, this.audioCtx.currentTime, 0.03);
        } else {
          this.delayFeedbackNode.gain.value = clamped;
          this.delayGainNode.gain.value = delayWet;
        }
      } catch {
        this.delayFeedbackNode.gain.value = clamped;
        this.delayGainNode.gain.value = clamped > 0 ? 0.75 : 0;
      }
    }
    this.saveSpatialToStorage();
  }

  setConvolverBuffer(duration: number, decay: number): void {
    if (!this.audioCtx || typeof this.audioCtx.createConvolver !== 'function') return;
    try {
      const impulse = this.createImpulseResponse(duration, decay);
      if (!impulse) return;

      if (!this.convolverNode) {
        this.convolverNode = this.audioCtx.createConvolver();
        this.convolverNode.buffer = impulse;
        this.connectNodes();
      } else {
        try {
          this.convolverNode.buffer = impulse;
        } catch {
          // Re-créer le ConvolverNode si le buffer ne peut être réassigné à chaud
          const newConvolver = this.audioCtx.createConvolver();
          newConvolver.buffer = impulse;
          this.convolverNode = newConvolver;
          this.connectNodes();
        }
      }
    } catch (e) {
      console.warn('[PlayerService] Échec du rechargement de la réponse impulsionnelle:', e);
    }
  }

  setSpatialPreset(name: 'none' | 'room' | 'hall' | 'stadium' | 'space-echo'): void {
    const presets: Record<string, { reverb: number; delay: number; feedback: number; duration: number; decay: number }> = {
      none: { reverb: 0, delay: 0.3, feedback: 0, duration: 2.0, decay: 2.0 },
      room: { reverb: 0.25, delay: 0.15, feedback: 0.15, duration: 1.2, decay: 3.5 },
      hall: { reverb: 0.55, delay: 0.3, feedback: 0.3, duration: 2.8, decay: 2.0 },
      stadium: { reverb: 0.8, delay: 0.45, feedback: 0.5, duration: 4.2, decay: 1.4 },
      'space-echo': { reverb: 0.4, delay: 0.65, feedback: 0.65, duration: 3.0, decay: 1.8 },
    };

    const target = presets[name] || presets['none'];
    this.setReverbWet(target.reverb);
    this.setDelayTime(target.delay);
    this.setDelayFeedback(target.feedback);
    if (name !== 'none') {
      this.setConvolverBuffer(target.duration, target.decay);
    }
    this.spatialPreset.set(name);
    this.saveSpatialToStorage();
  }

  resetSpatialEffects(): void {
    this.setSpatialPreset('none');
  }

  private saveSpatialToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = {
        reverbWet: this.reverbWet(),
        delayTime: this.delayTime(),
        delayFeedback: this.delayFeedback(),
        spatialPreset: this.spatialPreset(),
      };
      localStorage.setItem('from_zero_spatial', JSON.stringify(data));
    } catch {
      // Ignorer si stockage inaccessible
    }
  }

  private loadSpatialFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('from_zero_spatial');
      if (stored) {
        const data = JSON.parse(stored);
        if (typeof data.reverbWet === 'number') this.reverbWet.set(data.reverbWet);
        if (typeof data.delayTime === 'number') this.delayTime.set(data.delayTime);
        if (typeof data.delayFeedback === 'number') this.delayFeedback.set(data.delayFeedback);
        if (data.spatialPreset) this.spatialPreset.set(data.spatialPreset);
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
