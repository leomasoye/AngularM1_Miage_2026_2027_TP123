import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService } from '../../shared/services/player.service';
import { GlowService } from '../../shared/services/glow.service';

interface DustParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

@Component({
  selector: 'app-audio-reactive-glow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audio-reactive-glow.component.html',
  styleUrl: './audio-reactive-glow.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioReactiveGlowComponent implements OnInit, OnDestroy {
  readonly player = inject(PlayerService);
  readonly glow = inject(GlowService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly containerRef = viewChild<ElementRef<HTMLElement>>('glowContainer');

  private animationFrameId: number | null = null;
  private isDestroyed = false;
  private isLoopRunning = false;

  // Lissage temporel dynamique
  private smoothBass = 0.05;
  private smoothMid = 0.05;

  // Régulation à 35 FPS pour un 0% freeze
  private lastUpdateTimestamp = 0;
  private readonly TARGET_FRAME_MS = 28;

  // Système de particules de poussière d'étoiles CSS
  particles: DustParticle[] = [];

  constructor() {
    effect(() => {
      const isPlaying = this.player.isPlaying();
      const isEnabled = this.glow.isEnabled();

      if (isPlaying && isEnabled) {
        this.startLoop();
      } else if (!isEnabled) {
        this.stopLoop();
        this.resetStyles();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.stopLoop();
    });
  }

  ngOnInit(): void {
    const colors = ['#d89af8', '#9b3fd4', '#5aaaf5', '#1a7fe8'];
    this.particles = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: Math.round(Math.random() * 92) + 4,
      y: Math.round(Math.random() * 92) + 4,
      size: Math.round(1.5 + Math.random() * 2.5),
      color: colors[i % colors.length],
      duration: Math.round(10 + Math.random() * 10),
      delay: -Math.round(Math.random() * 12),
    }));

    this.setupListeners();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.stopLoop();
  }

  private setupListeners(): void {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.stopLoop();
      } else if (this.player.isPlaying() && this.glow.isEnabled()) {
        this.startLoop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    );
  }

  private startLoop(): void {
    if (this.isLoopRunning || this.isDestroyed) return;
    this.isLoopRunning = true;
    this.lastUpdateTimestamp = performance.now();

    this.ngZone.runOutsideAngular(() => {
      const loop = (now: DOMHighResTimeStamp) => {
        if (this.isDestroyed) {
          this.isLoopRunning = false;
          return;
        }

        if (!this.glow.isEnabled()) {
          this.resetStyles();
          this.isLoopRunning = false;
          return;
        }

        if (typeof document !== 'undefined' && document.hidden) {
          this.isLoopRunning = false;
          return;
        }

        const elapsed = now - this.lastUpdateTimestamp;
        if (elapsed >= this.TARGET_FRAME_MS) {
          this.lastUpdateTimestamp = now - (elapsed % this.TARGET_FRAME_MS);
          this.updateAudioReaction();
        }

        // Si la lecture est arrêtée et que l'amortissement est terminé, mise en veille de la boucle
        if (!this.player.isPlaying() && this.smoothBass < 0.015 && this.smoothMid < 0.015) {
          this.resetStyles();
          this.isLoopRunning = false;
          return;
        }

        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  private stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isLoopRunning = false;
  }

  private updateAudioReaction(): void {
    let targetBass = 0;
    let targetMid = 0;

    if (this.player.isPlaying()) {
      const freqData = this.player.getFrequencyData();
      if (freqData && freqData.length > 0) {
        // Basses (20-150 Hz, bins 0-2)
        const b0 = freqData[0] || 0;
        const b1 = freqData[1] || 0;
        const b2 = freqData[2] || 0;
        targetBass = (b0 * 1.1 + b1 * 0.9 + b2 * 0.7) / (255 * 2.7);

        // Médiums (200-1200 Hz, bins 3-8)
        let midSum = 0;
        const midCount = Math.min(freqData.length, 9);
        for (let i = 3; i < midCount; i++) {
          midSum += freqData[i];
        }
        targetMid = midSum / (255 * Math.max(1, midCount - 3));
      }
    }

    // Modulation selon l'intensité choisie
    const intensity = this.glow.intensity();
    targetBass *= intensity;
    targetMid *= intensity;

    // Attaque rapide sur le kick, déclin doux
    if (targetBass > this.smoothBass) {
      this.smoothBass = this.smoothBass * 0.35 + targetBass * 0.65;
    } else {
      this.smoothBass = this.smoothBass * 0.92 + targetBass * 0.08;
    }

    this.smoothMid = this.smoothMid * 0.9 + targetMid * 0.1;

    // Application directe sur les CSS Custom Properties (0 re-paint, 100% GPU)
    const el = this.containerRef()?.nativeElement;
    if (!el) return;

    const bassScale = (0.92 + this.smoothBass * 0.45).toFixed(3);
    const bassAlpha = (0.25 + this.smoothBass * 0.65).toFixed(3);
    const midScale = (0.94 + this.smoothMid * 0.35).toFixed(3);
    const midAlpha = (0.22 + this.smoothMid * 0.6).toFixed(3);
    const subScale = (0.88 + this.smoothBass * 0.48).toFixed(3);
    const subAlpha = (Math.max(0, this.smoothBass - 0.08) * 0.6).toFixed(3);
    const particleAlpha = (0.3 + this.smoothBass * 0.55).toFixed(3);

    el.style.setProperty('--bass-scale', bassScale);
    el.style.setProperty('--bass-alpha', bassAlpha);
    el.style.setProperty('--mid-scale', midScale);
    el.style.setProperty('--mid-alpha', midAlpha);
    el.style.setProperty('--sub-scale', subScale);
    el.style.setProperty('--sub-alpha', subAlpha);
    el.style.setProperty('--particle-alpha', particleAlpha);
  }

  private resetStyles(): void {
    const el = this.containerRef()?.nativeElement;
    if (!el) return;
    el.style.removeProperty('--bass-scale');
    el.style.removeProperty('--bass-alpha');
    el.style.removeProperty('--mid-scale');
    el.style.removeProperty('--mid-alpha');
    el.style.removeProperty('--sub-scale');
    el.style.removeProperty('--sub-alpha');
    el.style.removeProperty('--particle-alpha');
  }
}
