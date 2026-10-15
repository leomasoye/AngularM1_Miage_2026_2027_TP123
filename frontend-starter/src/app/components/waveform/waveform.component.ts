import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService } from '../../shared/services/player.service';

@Component({
  selector: 'app-waveform',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waveform.component.html',
  styleUrl: './waveform.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaveformComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly player = inject(PlayerService);
  private readonly ngZone = inject(NgZone);

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('waveformCanvas');
  readonly wrapperRef = viewChild<ElementRef<HTMLDivElement>>('waveformWrapper');

  readonly isHovering = signal(false);
  readonly hoverPercent = signal<number | null>(null);
  readonly hoverTime = signal(0);
  readonly hoverTimeFormatted = computed(() => this.formatTime(this.hoverTime()));

  private isScrubbing = false;
  private animationFrameId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private boundWindowMouseMove?: (e: MouseEvent) => void;
  private boundWindowMouseUp?: (e: MouseEvent) => void;
  private visibilityHandler?: () => void;
  private cachedPlayedGradient: CanvasGradient | null = null;
  private cachedGradientHeight = 0;

  constructor() {
    effect(() => {
      const playing = this.player.isPlaying();
      this.player.progress();
      this.player.waveformPeaks();

      if (playing) {
        this.startRenderLoop();
      } else {
        this.stopRenderLoop();
        this.drawWaveform();
      }
    });
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (!document.hidden && (this.player.isPlaying() || this.isScrubbing)) {
          this.startRenderLoop();
        } else if (document.hidden) {
          this.stopRenderLoop();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    if (this.player.isPlaying()) {
      this.startRenderLoop();
    }
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();
    this.updateCanvasDimensions();
    this.drawWaveform();
  }

  ngOnDestroy(): void {
    this.stopRenderLoop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.cleanupWindowListeners();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.updateCanvasDimensions();
      this.drawWaveform();
    });
    this.resizeObserver.observe(wrapper);
  }

  private updateCanvasDimensions(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const displayWidth = Math.max(60, Math.floor(rect.width));
    const displayHeight = Math.max(28, Math.floor(rect.height || 42));

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }

  private startRenderLoop(): void {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
    if (this.animationFrameId !== null) return;

    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        if (typeof document !== 'undefined' && document.hidden) {
          this.animationFrameId = null;
          return;
        }

        this.drawWaveform();

        if (this.player.isPlaying() || this.isScrubbing) {
          this.animationFrameId = requestAnimationFrame(render);
        } else {
          this.animationFrameId = null;
        }
      };
      this.animationFrameId = requestAnimationFrame(render);
    });
  }

  private stopRenderLoop(): void {
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  drawWaveform(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const peaks =
      this.player.waveformPeaks().length > 0
        ? this.player.waveformPeaks()
        : this.player.generateFallbackPeaks(120);

    const totalBars = peaks.length;
    if (totalBars === 0 || width <= 0 || height <= 0) return;

    const currentProgress = this.player.progress();
    const hoverPct = this.hoverPercent();

    // Espacement et largeur de chaque barre
    const gap = 2;
    const totalGaps = (totalBars - 1) * gap;
    const barWidth = Math.max(1.5, (width - totalGaps) / totalBars);
    const centerY = height / 2;

    // Cache du dégradé vertical From Zero pour éviter des milliers d'allocations par seconde
    if (!this.cachedPlayedGradient || this.cachedGradientHeight !== height) {
      this.cachedGradientHeight = height;
      this.cachedPlayedGradient = ctx.createLinearGradient(0, 0, 0, height);
      this.cachedPlayedGradient.addColorStop(0, '#d89af8');
      this.cachedPlayedGradient.addColorStop(0.4, '#9b3fd4');
      this.cachedPlayedGradient.addColorStop(1, '#1a7fe8');
    }

    const COLOR_UNPLAYED = 'rgba(155, 63, 212, 0.22)';
    const COLOR_HOVERED = 'rgba(155, 63, 212, 0.55)';

    for (let i = 0; i < totalBars; i++) {
      const x = i * (barWidth + gap);
      const barProgress = (i / totalBars) * 100;
      const peak = peaks[i];

      // Hauteur de la barre centrée verticalement
      const barHeight = Math.max(4, peak * (height - 8));
      const y = centerY - barHeight / 2;

      const isPlayed = barProgress <= currentProgress;
      const isHovered =
        hoverPct !== null && Math.abs(barProgress - hoverPct) < 100 / totalBars;

      if (isPlayed) {
        ctx.fillStyle = this.cachedPlayedGradient;
      } else {
        ctx.fillStyle = isHovered ? COLOR_HOVERED : COLOR_UNPLAYED;
      }

      // Dessin de la barre avec extrémités arrondies
      const radius = Math.min(2, barWidth / 2);
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }

    ctx.shadowBlur = 0;
  }

  // --- Gestion des interactions de la souris & du toucher ---

  onMouseEnter(event: MouseEvent): void {
    this.isHovering.set(true);
    this.updateHover(event);
  }

  onMouseMove(event: MouseEvent): void {
    this.updateHover(event);
  }

  onMouseLeave(): void {
    if (!this.isScrubbing) {
      this.isHovering.set(false);
      this.hoverPercent.set(null);
      this.drawWaveform();
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // Clic gauche uniquement
    event.preventDefault();
    this.isScrubbing = true;
    this.isHovering.set(true);

    const pct = this.getPercentFromEvent(event);
    this.player.startSeeking();
    this.player.seekPercent(pct);
    this.hoverPercent.set(pct);
    this.hoverTime.set((pct / 100) * this.player.duration());

    this.bindWindowListeners();
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 0) return;
    this.isScrubbing = true;
    this.isHovering.set(true);

    const pct = this.getPercentFromTouchEvent(event.touches[0]);
    this.player.startSeeking();
    this.player.seekPercent(pct);
    this.hoverPercent.set(pct);
    this.hoverTime.set((pct / 100) * this.player.duration());
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isScrubbing || event.touches.length === 0) return;
    event.preventDefault();
    const pct = this.getPercentFromTouchEvent(event.touches[0]);
    this.player.seekPercent(pct);
    this.hoverPercent.set(pct);
    this.hoverTime.set((pct / 100) * this.player.duration());
  }

  onTouchEnd(): void {
    if (!this.isScrubbing) return;
    this.isScrubbing = false;
    this.isHovering.set(false);
    this.hoverPercent.set(null);
    this.player.endSeeking();
  }

  onKeyDown(event: KeyboardEvent): void {
    const cur = this.player.currentTime();
    const dur = this.player.duration();
    if (dur <= 0) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const target = Math.max(0, cur - 5);
      this.player.endSeeking((target / dur) * 100);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const target = Math.min(dur, cur + 5);
      this.player.endSeeking((target / dur) * 100);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.player.endSeeking(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.player.endSeeking(100);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      void this.player.togglePlay();
    }
  }

  private updateHover(event: MouseEvent): void {
    const pct = this.getPercentFromEvent(event);
    this.hoverPercent.set(pct);
    this.hoverTime.set((pct / 100) * this.player.duration());
    this.drawWaveform();
  }

  private getPercentFromEvent(event: MouseEvent): number {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return 0;
    const rect = wrapper.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clamped = Math.max(0, Math.min(rect.width, clickX));
    return rect.width > 0 ? (clamped / rect.width) * 100 : 0;
  }

  private getPercentFromTouchEvent(touch: Touch): number {
    const wrapper = this.wrapperRef()?.nativeElement;
    if (!wrapper) return 0;
    const rect = wrapper.getBoundingClientRect();
    const clickX = touch.clientX - rect.left;
    const clamped = Math.max(0, Math.min(rect.width, clickX));
    return rect.width > 0 ? (clamped / rect.width) * 100 : 0;
  }

  private bindWindowListeners(): void {
    this.cleanupWindowListeners();

    this.boundWindowMouseMove = (e: MouseEvent) => {
      if (!this.isScrubbing) return;
      const pct = this.getPercentFromEvent(e);
      this.player.seekPercent(pct);
      this.hoverPercent.set(pct);
      this.hoverTime.set((pct / 100) * this.player.duration());
    };

    this.boundWindowMouseUp = (e: MouseEvent) => {
      if (!this.isScrubbing) return;
      this.isScrubbing = false;
      const pct = this.getPercentFromEvent(e);
      this.player.endSeeking(pct);
      this.isHovering.set(false);
      this.hoverPercent.set(null);
      this.cleanupWindowListeners();
    };

    window.addEventListener('mousemove', this.boundWindowMouseMove);
    window.addEventListener('mouseup', this.boundWindowMouseUp);
  }

  private cleanupWindowListeners(): void {
    if (this.boundWindowMouseMove) {
      window.removeEventListener('mousemove', this.boundWindowMouseMove);
      this.boundWindowMouseMove = undefined;
    }
    if (this.boundWindowMouseUp) {
      window.removeEventListener('mouseup', this.boundWindowMouseUp);
      this.boundWindowMouseUp = undefined;
    }
  }

  private formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
