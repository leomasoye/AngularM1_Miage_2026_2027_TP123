import {
  Component,
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PlayerService } from '../../shared/services/player.service';
import { Track } from '../../shared/models/track.model';
import { LikeButtonComponent } from '../like-button/like-button';
import { EqualizerComponent } from '../equalizer/equalizer.component';
import { WaveformComponent } from '../waveform/waveform.component';

@Component({
  selector: 'app-player-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    LikeButtonComponent,
    WaveformComponent,
  ],
  templateUrl: './player-bar.component.html',
  styleUrl: './player-bar.component.css',
})
export class PlayerBarComponent implements OnInit, OnDestroy {
  readonly player = inject(PlayerService);
  private readonly dialog = inject(MatDialog);
  private readonly ngZone = inject(NgZone);

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('visualizerCanvas');

  readonly isQueueOpen = signal(false);

  private animationFrameId: number | null = null;
  private visibilityHandler?: () => void;

  constructor() {
    effect(() => {
      if (this.player.isPlaying()) {
        this.startVisualizer();
      } else {
        this.stopVisualizer();
        this.drawVisualizer();
      }
    });
  }

  toggleQueue(): void {
    this.isQueueOpen.update((open) => !open);
  }

  closeQueue(): void {
    this.isQueueOpen.set(false);
  }

  playQueuedTrack(track: Track, index: number): void {
    this.player.removeFromQueue(index);
    void this.player.playTrack(track);
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (!document.hidden && this.player.isPlaying()) {
          this.startVisualizer();
        } else if (document.hidden) {
          this.stopVisualizer();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    this.drawVisualizer();
    if (this.player.isPlaying()) {
      this.startVisualizer();
    }
  }

  ngOnDestroy(): void {
    this.stopVisualizer();
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  onProgressInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.player.startSeeking();
    this.player.seekPercent(val);
  }

  onProgressChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.player.endSeeking(val);
  }

  onVolumeChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.player.setVolume(val / 100);
  }

  rewind(): void {
    const cur = this.player.currentTime();
    const dur = this.player.duration();
    const target = Math.max(0, cur - 5);
    const pct = dur > 0 ? (target / dur) * 100 : 0;
    this.player.endSeeking(pct);
  }

  forward(): void {
    const cur = this.player.currentTime();
    const dur = this.player.duration();
    const target = Math.min(dur, cur + 5);
    const pct = dur > 0 ? (target / dur) * 100 : 0;
    this.player.endSeeking(pct);
  }

  openEqualizer(): void {
    this.dialog.open(EqualizerComponent, {
      width: '580px',
      panelClass: 'from-zero-dialog',
    });
  }

  private startVisualizer(): void {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
    if (this.animationFrameId !== null) return;

    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        if (typeof document !== 'undefined' && document.hidden) {
          this.animationFrameId = null;
          return;
        }

        this.drawVisualizer();

        if (this.player.isPlaying()) {
          this.animationFrameId = requestAnimationFrame(render);
        } else {
          this.animationFrameId = null;
        }
      };
      this.animationFrameId = requestAnimationFrame(render);
    });
  }

  private stopVisualizer(): void {
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private drawVisualizer(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!this.player.isPlaying()) {
      ctx.fillStyle = 'rgba(155, 63, 212, 0.2)';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    // 1. Barres de fréquence FFT (gauche du canvas : 0 à 96px)
    const freqData = this.player.getFrequencyData();
    const fftWidth = 96;
    if (freqData && freqData.length > 0) {
      const barsCount = 14;
      const barWidth = Math.floor(fftWidth / barsCount) - 2;
      const step = Math.floor(freqData.length / barsCount) || 1;

      for (let i = 0; i < barsCount; i++) {
        const val = freqData[i * step] || 0;
        const barHeight = Math.max(2, (val / 255) * height);
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, '#1a7fe8');
        grad.addColorStop(1, '#9b3fd4');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }

    // Séparateur vertical subtil
    ctx.fillStyle = 'rgba(155, 63, 212, 0.25)';
    ctx.fillRect(104, 2, 1, height - 4);

    // 2. VU-mètres Stéréo distincts Gauche (L) & Droite (R) (112px à 136px)
    const vu = this.player.getStereoVULevels();
    const vuWidth = 9;

    // Track L (x = 112)
    const leftHeight = Math.min(height, Math.max(2, vu.left * height));
    const leftY = height - leftHeight;
    const leftGrad = ctx.createLinearGradient(0, height, 0, 0);
    leftGrad.addColorStop(0, '#00e676');
    leftGrad.addColorStop(0.7, '#9b3fd4');
    leftGrad.addColorStop(1, '#ff1744');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(112, leftY, vuWidth, leftHeight);

    // Peak L
    const leftPeakY = Math.max(0, height - (vu.leftPeak * height) - 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(112, leftPeakY, vuWidth, 2);

    // Track R (x = 125)
    const rightHeight = Math.min(height, Math.max(2, vu.right * height));
    const rightY = height - rightHeight;
    const rightGrad = ctx.createLinearGradient(0, height, 0, 0);
    rightGrad.addColorStop(0, '#00e676');
    rightGrad.addColorStop(0.7, '#1a7fe8');
    rightGrad.addColorStop(1, '#ff1744');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(125, rightY, vuWidth, rightHeight);

    // Peak R
    const rightPeakY = Math.max(0, height - (vu.rightPeak * height) - 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(125, rightPeakY, vuWidth, 2);
  }
}
