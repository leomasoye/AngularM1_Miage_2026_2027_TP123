import {
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PlayerService } from '../../shared/services/player.service';
import { LikeButtonComponent } from '../like-button/like-button';

@Component({
  selector: 'app-player-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LikeButtonComponent,
  ],
  templateUrl: './player-bar.component.html',
  styleUrl: './player-bar.component.css',
})
export class PlayerBarComponent implements OnInit, OnDestroy {
  readonly player = inject(PlayerService);
  private readonly ngZone = inject(NgZone);

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('visualizerCanvas');

  private animationFrameId: number | null = null;

  ngOnInit(): void {
    this.startVisualizer();
  }

  ngOnDestroy(): void {
    this.stopVisualizer();
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

  private startVisualizer(): void {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        this.drawVisualizer();
        this.animationFrameId = requestAnimationFrame(render);
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

    const freqData = this.player.getFrequencyData();
    if (!freqData || freqData.length === 0) return;

    const barsCount = 20;
    const barWidth = Math.floor(width / barsCount) - 2;
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
}
