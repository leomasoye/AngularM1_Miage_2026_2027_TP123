import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-like-button',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <button mat-icon-button (click)="toggleLike()" [class.liked]="isLiked()" [title]="isLiked() ? 'Je n\'aime plus' : 'J\'aime'">
      <mat-icon [style.color]="isLiked() ? 'var(--orchid-300)' : 'var(--text-muted)'">
        {{ isLiked() ? 'favorite' : 'favorite_border' }}
      </mat-icon>
    </button>
    <span class="text-small text-muted" *ngIf="track.likes.length > 0">{{ track.likes.length }}</span>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
  `]
})
export class LikeButtonComponent {
  @Input({ required: true }) track!: Track;
  @Output() trackUpdated = new EventEmitter<Track>();

  private readonly trackService = inject(TrackService);
  private readonly auth = inject(AuthService);

  isLiked(): boolean {
    const userId = this.auth.currentUser()?.id;
    return !!userId && this.track.likes.includes(userId);
  }

  toggleLike() {
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;

    const liked = this.isLiked();

    // Optimistic Update
    if (liked) {
      this.track.likes = this.track.likes.filter(id => id !== userId);
    } else {
      this.track.likes.push(userId);
    }

    const request = liked 
      ? this.trackService.unlike(this.track.id)
      : this.trackService.like(this.track.id);

    request.subscribe({
      next: (updatedTrack) => {
        this.track = updatedTrack;
        this.trackUpdated.emit(updatedTrack);
      },
      error: () => {
        // Rollback
        if (liked) {
          this.track.likes.push(userId);
        } else {
          this.track.likes = this.track.likes.filter(id => id !== userId);
        }
        console.error('Erreur lors du like');
      }
    });
  }
}
