import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService } from '../../shared/services/player.service';
import { GlowService } from '../../shared/services/glow.service';

interface GlowParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  color: string;
  pulseOffset: number;
}

@Component({
  selector: 'app-audio-reactive-glow',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audio-reactive-glow.component.html',
  styleUrl: './audio-reactive-glow.component.css',
})
export class AudioReactiveGlowComponent implements AfterViewInit, OnDestroy {
  private readonly player = inject(PlayerService);
  readonly glow = inject(GlowService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('glowCanvas');

  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed = false;
  private isLoopRunning = false;

  // Lissage temporel dynamique
  private smoothBass = 0.05;
  private smoothMid = 0.05;
  private smoothHigh = 0.05;
  private time = 0;

  // Système de particules ambiantes
  private particles: GlowParticle[] = [];
  private readonly PARTICLE_COUNT = 36;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.stopLoop();
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.initCanvasSize();
    this.initParticles();
    this.setupListeners();
    this.startLoop();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.stopLoop();
  }

  private initCanvasSize(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
  }

  private initParticles(): void {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 800;
    const colors = [
      'rgba(196, 122, 237, ', // Orchid bright
      'rgba(155, 63, 212, ',  // Orchid core
      'rgba(90, 170, 245, ',  // Electric blue bright
      'rgba(26, 127, 232, ',  // Electric blue core
    ];

    this.particles = [];
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      const baseRadius = 1.2 + Math.random() * 2.2;
      const baseAlpha = 0.15 + Math.random() * 0.35;
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.4, // Dérive ascendante lente
        baseRadius,
        radius: baseRadius,
        baseAlpha,
        alpha: baseAlpha,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    // Gestion du redimensionnement
    const handleResize = () => {
      this.initCanvasSize();
    };
    window.addEventListener('resize', handleResize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', handleResize));

    // Gestion de la visibilité de l'onglet
    if (typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          this.stopLoop();
        } else {
          this.startLoop();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      this.destroyRef.onDestroy(() =>
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      );
    }
  }

  private startLoop(): void {
    if (this.isLoopRunning || this.isDestroyed) return;
    this.isLoopRunning = true;

    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        if (this.isDestroyed) {
          this.isLoopRunning = false;
          return;
        }

        // Si l'effet est désactivé par l'utilisateur
        if (!this.glow.isEnabled()) {
          this.clearCanvas();
          this.isLoopRunning = false;
          return;
        }

        // Si le document est masqué
        if (typeof document !== 'undefined' && document.hidden) {
          this.isLoopRunning = false;
          return;
        }

        this.renderFrame();

        // Si la musique est en pause et que l'énergie résiduelle est totalement dissipée, on suspend la boucle
        if (!this.player.isPlaying() && this.smoothBass < 0.015 && this.smoothMid < 0.015) {
          this.clearCanvas();
          this.isLoopRunning = false;
          return;
        }

        this.animationFrameId = requestAnimationFrame(render);
      };

      this.animationFrameId = requestAnimationFrame(render);
    });
  }

  private stopLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isLoopRunning = false;
  }

  private clearCanvas(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  private renderFrame(): void {
    if (!this.ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.time += 0.016; // progression temporelle fluide

    // Extraction et analyse des fréquences Web Audio
    let targetBass = 0;
    let targetMid = 0;
    let targetHigh = 0;

    if (this.player.isPlaying()) {
      const freqData = this.player.getFrequencyData();
      if (freqData && freqData.length > 0) {
        // Basses fréquences (20 - 150 Hz, bins 0-2)
        const b0 = freqData[0] || 0;
        const b1 = freqData[1] || 0;
        const b2 = freqData[2] || 0;
        targetBass = (b0 * 1.0 + b1 * 0.85 + b2 * 0.6) / (255 * 2.45);

        // Médiums (200 - 1200 Hz, bins 3-8)
        let midSum = 0;
        const midCount = Math.min(freqData.length, 9);
        for (let i = 3; i < midCount; i++) {
          midSum += freqData[i];
        }
        targetMid = midSum / (255 * Math.max(1, midCount - 3));

        // Aigus (présence, bins 10-25)
        let highSum = 0;
        const highCount = Math.min(freqData.length, 25);
        for (let i = 10; i < highCount; i++) {
          highSum += freqData[i];
        }
        targetHigh = highSum / (255 * Math.max(1, highCount - 10));
      }
    }

    // Lissage temporel : attaque immédiate (punch du kick), décroissance exponentielle douce
    const intensity = this.glow.intensity();
    targetBass *= intensity;
    targetMid *= intensity;
    targetHigh *= intensity;

    if (targetBass > this.smoothBass) {
      this.smoothBass = this.smoothBass * 0.35 + targetBass * 0.65; // Attaque rapide
    } else {
      this.smoothBass = this.smoothBass * 0.92 + targetBass * 0.08; // Décroissance douce
    }

    this.smoothMid = this.smoothMid * 0.88 + targetMid * 0.12;
    this.smoothHigh = this.smoothHigh * 0.88 + targetHigh * 0.12;

    // Effacer le canvas avant le rendu
    this.ctx.clearRect(0, 0, w, h);

    // 1. Dessiner les halos lumineux réactifs (Orbes From Zero)
    this.drawReactiveGlowOrbs(w, h);

    // 2. Dessiner les particules ambiantes réactives (si activées)
    if (this.glow.particlesEnabled()) {
      this.drawParticles(w, h);
    }
  }

  private drawReactiveGlowOrbs(w: number, h: number): void {
    if (!this.ctx) return;

    // Facteur d'amplification
    const bass = Math.max(0, this.smoothBass);
    const mid = Math.max(0, this.smoothMid);

    // ORBE 1 : Signature Orchid (Pulse avec le Kick & Basse)
    // Position flottante organique en haut / centre-gauche
    const orb1X = w * 0.28 + Math.sin(this.time * 0.4) * 60;
    const orb1Y = h * 0.32 + Math.cos(this.time * 0.3) * 45;
    const orb1Radius = Math.max(200, Math.min(w, h) * (0.42 + 0.25 * bass));

    const grad1 = this.ctx.createRadialGradient(
      orb1X,
      orb1Y,
      0,
      orb1X,
      orb1Y,
      orb1Radius
    );
    // Alpha modulé par l'intensité de la basse
    const orb1Alpha = Math.min(0.55, 0.18 + 0.32 * bass);
    grad1.addColorStop(0, `rgba(155, 63, 212, ${orb1Alpha})`);
    grad1.addColorStop(0.45, `rgba(107, 31, 168, ${orb1Alpha * 0.5})`);
    grad1.addColorStop(0.8, `rgba(45, 10, 61, ${orb1Alpha * 0.18})`);
    grad1.addColorStop(1, 'rgba(13, 13, 15, 0)');

    this.ctx.fillStyle = grad1;
    this.ctx.beginPath();
    this.ctx.arc(orb1X, orb1Y, orb1Radius, 0, Math.PI * 2);
    this.ctx.fill();

    // ORBE 2 : Signature Electric Blue (Pulse avec la mélodie et les médiums)
    // Position flottante en bas / centre-droit
    const orb2X = w * 0.76 + Math.cos(this.time * 0.35) * 55;
    const orb2Y = h * 0.62 + Math.sin(this.time * 0.45) * 40;
    const orb2Radius = Math.max(180, Math.min(w, h) * (0.38 + 0.22 * mid));

    const grad2 = this.ctx.createRadialGradient(
      orb2X,
      orb2Y,
      0,
      orb2X,
      orb2Y,
      orb2Radius
    );
    const orb2Alpha = Math.min(0.48, 0.14 + 0.28 * mid);
    grad2.addColorStop(0, `rgba(26, 127, 232, ${orb2Alpha})`);
    grad2.addColorStop(0.45, `rgba(10, 64, 128, ${orb2Alpha * 0.45})`);
    grad2.addColorStop(0.8, `rgba(2, 11, 26, ${orb2Alpha * 0.15})`);
    grad2.addColorStop(1, 'rgba(13, 13, 15, 0)');

    this.ctx.fillStyle = grad2;
    this.ctx.beginPath();
    this.ctx.arc(orb2X, orb2Y, orb2Radius, 0, Math.PI * 2);
    this.ctx.fill();

    // ORBE 3 : Halo central subtil (Sub-bass anchor au centre)
    if (bass > 0.15) {
      const orb3X = w * 0.5 + Math.sin(this.time * 0.2) * 30;
      const orb3Y = h * 0.5 + Math.cos(this.time * 0.25) * 20;
      const orb3Radius = Math.min(w, h) * (0.55 + 0.2 * bass);

      const grad3 = this.ctx.createRadialGradient(
        orb3X,
        orb3Y,
        0,
        orb3X,
        orb3Y,
        orb3Radius
      );
      const orb3Alpha = (bass - 0.15) * 0.22;
      grad3.addColorStop(0, `rgba(196, 122, 237, ${orb3Alpha})`);
      grad3.addColorStop(0.6, `rgba(90, 170, 245, ${orb3Alpha * 0.4})`);
      grad3.addColorStop(1, 'rgba(13, 13, 15, 0)');

      this.ctx.fillStyle = grad3;
      this.ctx.beginPath();
      this.ctx.arc(orb3X, orb3Y, orb3Radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawParticles(w: number, h: number): void {
    if (!this.ctx) return;

    const bass = this.smoothBass;
    const speedMultiplier = 1.0 + bass * 1.8;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Mise à jour de la position
      p.x += p.vx * speedMultiplier + Math.sin(this.time + p.pulseOffset) * 0.25;
      p.y += p.vy * speedMultiplier;

      // Bouclage aux bords
      if (p.x < -10) p.x = w + 10;
      else if (p.x > w + 10) p.x = -10;

      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }

      // Expansion et brillance réactives lors des kicks
      const currentRadius = p.baseRadius * (1.0 + bass * 0.9);
      const currentAlpha = Math.min(0.9, p.baseAlpha * (1.0 + bass * 1.4));

      // Rendu de la particule
      this.ctx.fillStyle = `${p.color}${currentAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
