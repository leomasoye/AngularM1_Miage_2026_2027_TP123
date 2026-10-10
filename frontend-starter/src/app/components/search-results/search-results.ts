import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { FriendsService } from '../../shared/services/friends.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LikeButtonComponent } from '../like-button/like-button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { SearchService, SearchResults } from '../../shared/services/search.service';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatIconModule, MatButtonModule, LikeButtonComponent],
  templateUrl: './search-results.html',
  styleUrl: './search-results.css'
})
export class SearchResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);
  private readonly friendsService = inject(FriendsService);
  private readonly snackBar = inject(MatSnackBar);

  addFriend(userId: string) {
    this.friendsService.addFriend(userId).subscribe({
      next: () => this.snackBar.open("Demande d'amitié envoyée !", 'Fermer', { duration: 3000 }),
      error: (err) => this.snackBar.open(err.error?.message || "Erreur lors de l'envoi de la demande", 'Fermer', { duration: 3000 })
    });
  }

  readonly query = signal('');
  readonly loading = signal(false);
  readonly results = signal<SearchResults>({ users: [], tracks: [] });
  readonly error = signal('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const q = params['q'] || '';
      this.query.set(q);
      if (q) {
        this.performSearch(q);
      } else {
        this.results.set({ users: [], tracks: [] });
      }
    });
  }

  updateQuery(newQuery: string) {
    if (!newQuery.trim()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: newQuery.trim() },
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


