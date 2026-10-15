import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { FriendsService } from '../../shared/services/friends.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LikeButtonComponent } from '../like-button/like-button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SearchService, SearchResults } from '../../shared/services/search.service';
import { PlayerService } from '../../shared/services/player.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { AddToPlaylistModalComponent } from '../add-to-playlist-modal/add-to-playlist-modal.component';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    LikeButtonComponent,
    AvatarComponent,
  ],
  templateUrl: './search-results.html',
  styleUrl: './search-results.css'
})
export class SearchResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);
  private readonly friendsService = inject(FriendsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly player = inject(PlayerService);

  private readonly searchSubject = new Subject<string>();

  readonly query = signal('');
  readonly loading = signal(false);
  readonly results = signal<SearchResults>({ users: [], tracks: [] });
  readonly error = signal('');

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((val) => {
        const trimmed = val.trim();
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: trimmed || null },
          queryParamsHandling: 'merge'
        });
      });
  }

  play(track: any): void {
    if (this.player.currentTrack()?.id === track.id) {
      void this.player.togglePlay();
    } else {
      void this.player.playTrack(track);
    }
  }

  addToQueue(track: any): void {
    this.player.addToQueue(track);
    this.snackBar.open(`"${track.title}" ajouté à la file d'attente.`, 'Fermer', { duration: 3000 });
  }

  openAddToPlaylist(track: any): void {
    this.dialog.open(AddToPlaylistModalComponent, {
      data: { track },
      width: '460px',
    });
  }

  addFriend(userId: string) {
    this.friendsService.addFriend(userId).subscribe({
      next: () => this.snackBar.open("Demande d'amitié envoyée !", 'Fermer', { duration: 3000 }),
      error: (err) => this.snackBar.open(err.error?.message || "Erreur lors de l'envoi de la demande", 'Fermer', { duration: 3000 })
    });
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
    this.searchSubject.next(val);
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'] || '';
      this.query.set(q);
      this.performSearch(q);
    });
  }

  clearSearch() {
    this.query.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge'
    });
  }

  updateQuery(newQuery: string) {
    const trimmed = newQuery.trim();
    this.query.set(trimmed);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: trimmed || null },
      queryParamsHandling: 'merge'
    });
  }

  private performSearch(q: string) {
    this.loading.set(true);
    this.error.set('');
    this.searchService.search(q).subscribe({
      next: (res) => {
        this.results.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Une erreur est survenue lors de la recherche.');
        this.loading.set(false);
      }
    });
  }
}


