import { Component, ElementRef, inject, NgZone, OnDestroy, OnInit, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EQPreset, PlayerService } from '../../shared/services/player.service';

@Component({
  selector: 'app-equalizer',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './equalizer.component.html',
  styleUrl: './equalizer.component.css',
})
export class EqualizerComponent implements OnInit, OnDestroy {
  readonly player = inject(PlayerService);
  readonly dialogRef = inject(MatDialogRef<EqualizerComponent>, { optional: true });
  private readonly ngZone = inject(NgZone);

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('oscilloscopeCanvas');

  private animationFrameId: number | null = null;
  leftLevel = 0;
  rightLevel = 0;
  leftPeak = 0;
  rightPeak = 0;

  ngOnInit(): void {
    this.startAnimation();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  onBassChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.player.setBass(val);
  }

  onMidChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.player.setMid(val);
  }

  onTrebleChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.player.setTreble(val);
  }

  selectPreset(name: EQPreset): void {
    if (name === 'custom') return;
    this.player.setPreset(name);
  }

  reset(): void {
    this.player.resetEQ();
  }

  close(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  private startAnimation(): void {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;

    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        const vu = this.player.getStereoVULevels();
        this.leftLevel = vu.left;
        this.rightLevel = vu.right;
        this.leftPeak = vu.leftPeak;
        this.rightPeak = vu.rightPeak;

        this.drawOscilloscope();

        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private drawOscilloscope(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!this.player.isPlaying()) {
      ctx.strokeStyle = 'rgba(155, 63, 212, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const timeData = this.player.getTimeDomainData();
    if (!timeData || timeData.length === 0) return;

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#9b3fd4');
    grad.addColorStop(0.5, '#1a7fe8');
    grad.addColorStop(1, '#9b3fd4');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#9b3fd4';
    ctx.beginPath();

    const sliceWidth = width / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
