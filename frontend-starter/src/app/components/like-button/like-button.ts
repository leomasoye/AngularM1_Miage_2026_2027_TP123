import { Component, computed, EventEmitter, inject, Input, Output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-like-button',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <button mat-icon-button (click)="toggleLike()" [title]="likeTitle()">
      <mat-icon [style.color]="liked() ? 'var(--orchid-300)' : 'var(--text-muted)'">
        {{ liked() ? 'favorite' : 'favorite_border' }}
      </mat-icon>
    </button>
    @if (likesCount() > 0) {
      <span class="text-small text-muted">{{ likesCount() }}</span>
    }
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
  @Input({ required: true }) set track(value: Track) {
    this._track = value;
    const userId = this.auth.currentUser()?.id;
    const likes = Array.isArray(value?.likes) ? value.likes : [];
    this.liked.set(!!userId && likes.includes(userId));
    this.likesCount.set(likes.length);
  }
  get track(): Track { return this._track; }
  private _track!: Track;

  @Output() trackUpdated = new EventEmitter<Track>();

  readonly liked = signal(false);
  readonly likesCount = signal(0);
  readonly likeTitle = computed(() => this.liked() ? "Je n'aime plus" : "J'aime");

  private readonly trackService = inject(TrackService);
  private readonly auth = inject(AuthService);

  toggleLike() {
    const userId = this.auth.currentUser()?.id;
    if (!userId || !this._track) return;

    const wasLiked = this.liked();

    // Optimistic Update : UI change immédiatement
    this.liked.set(!wasLiked);
    this.likesCount.update(c => wasLiked ? Math.max(0, c - 1) : c + 1);

    const request = wasLiked
      ? this.trackService.unlike(this._track.id)
      : this.trackService.like(this._track.id);

    request.subscribe({
      next: (updatedTrack) => {
        const likes = Array.isArray(updatedTrack?.likes) ? updatedTrack.likes : [];
        const newLiked = !!userId && likes.includes(userId);
        this.liked.set(newLiked);
        this.likesCount.set(likes.length);
        this._track = updatedTrack;
        this.trackUpdated.emit(updatedTrack);
      },
      error: () => {
        // Rollback si erreur HTTP
        this.liked.set(wasLiked);
        this.likesCount.update(c => wasLiked ? c + 1 : Math.max(0, c - 1));
        console.error('[LikeButton] Erreur lors du like, rollback appliqué');
      }
    });
  }
}
