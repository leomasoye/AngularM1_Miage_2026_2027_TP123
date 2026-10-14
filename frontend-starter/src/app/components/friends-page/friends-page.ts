import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FriendsService, Friendship } from '../../shared/services/friends.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-friends-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './friends-page.html',
  styleUrl: './friends-page.css'
})
export class FriendsPageComponent implements OnInit {
  private readonly friendsService = inject(FriendsService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly friendships = signal<Friendship[]>([]);

  ngOnInit() {
    this.loadFriends();
  }

  loadFriends() {
    const cached = this.friendsService.getCachedFriends();
    if (cached) {
      this.friendships.set(cached);
      this.loading.set(false);
    } else {
      this.loading.set(true);
    }

    this.friendsService.getFriends().subscribe({
      next: (data) => {
        this.friendships.set(data);
        this.loading.set(false);
      },
      error: () => {
        if (!cached) {
          this.snackBar.open('Erreur lors du chargement des amis', 'Fermer', { duration: 3000 });
        }
        this.loading.set(false);
      }
    });
  }

  readonly pendingIncoming = computed(() =>
    this.friendships().filter(f => f.status === 'pending' && f.isIncoming)
  );

  readonly pendingOutgoing = computed(() =>
    this.friendships().filter(f => f.status === 'pending' && !f.isIncoming)
  );

  readonly acceptedFriends = computed(() =>
    this.friendships().filter(f => f.status === 'accepted')
  );

  updateStatus(friendship: Friendship, status: 'accepted' | 'rejected') {
    const previous = this.friendships();
    // ⚡ Optimistic Update : modification immédiate dans l'UI
    this.friendships.update(list =>
      list.map(f => f.id === friendship.id ? { ...f, status } : f)
    );
    this.snackBar.open(`Demande ${status === 'accepted' ? 'acceptée' : 'refusée'}`, 'Fermer', { duration: 2500 });

    this.friendsService.updateStatus(friendship.id, status).subscribe({
      next: (updated) => {
        this.friendships.update(list =>
          list.map(f => f.id === updated.id ? { ...f, status: updated.status } : f)
        );
      },
      error: () => {
        // Rollback
        this.friendships.set(previous);
        this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 3000 });
      }
    });
  }

  removeFriend(friendship: Friendship) {
    const previous = this.friendships();
    // ⚡ Optimistic Update : retrait immédiat de l'UI
    this.friendships.update(list => list.filter(f => f.id !== friendship.id));
    this.snackBar.open('Ami supprimé', 'Fermer', { duration: 2500 });

    this.friendsService.removeFriend(friendship.id).subscribe({
      error: () => {
        // Rollback
        this.friendships.set(previous);
        this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
      }
    });
  }
}
