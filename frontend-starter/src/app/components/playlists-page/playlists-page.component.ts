import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlaylistService } from '../../shared/services/playlist.service';
import { PlayerService } from '../../shared/services/player.service';
import { AuthService } from '../../shared/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { LikeButtonComponent } from '../like-button/like-button';
import { Playlist } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';

@Component({
  selector: 'app-playlists-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AvatarComponent,
    LikeButtonComponent,
  ],
  templateUrl: './playlists-page.component.html',
  styleUrl: './playlists-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaylistsPageComponent implements OnInit {
  private readonly playlistService = inject(PlaylistService);
  readonly player = inject(PlayerService);
  readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly activeTab = signal<'all' | 'my' | 'public'>('all');
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // ID de la playlist actuellement développée pour voir les morceaux
  readonly expandedPlaylistId = signal<string | null>(null);
  readonly loadingDetailsId = signal<string | null>(null);

  // Formulaire création
  readonly showCreateModal = signal<boolean>(false);
  newPlaylistName = '';
  newPlaylistDesc = '';
  newPlaylistVisibility: 'public' | 'private' = 'public';
  readonly creating = signal<boolean>(false);

  // Formulaire édition
  readonly editingPlaylist = signal<Playlist | null>(null);
  editName = '';
  editDesc = '';
  editVisibility: 'public' | 'private' = 'public';
  readonly updating = signal<boolean>(false);

  // Suppression
  readonly deletingId = signal<string | null>(null);

  readonly playlists = this.playlistService.playlists;

  readonly filteredPlaylists = computed(() => {
    const list = this.playlists();
    const tab = this.activeTab();
    const currentUserId = this.auth.currentUser()?.id;

    if (tab === 'my') {
      return list.filter((p) => p.ownerId === currentUserId);
    }
    if (tab === 'public') {
      return list.filter((p) => p.visibility === 'public');
    }
    return list;
  });

  ngOnInit(): void {
    this.loadPlaylists();
  }

  loadPlaylists(): void {
    this.loading.set(true);
    this.error.set(null);
    this.playlistService.loadPlaylists().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Impossible de charger les playlists');
        this.loading.set(false);
      },
    });
  }

  setTab(tab: 'all' | 'my' | 'public'): void {
    this.activeTab.set(tab);
  }

  isOwner(playlist: Playlist): boolean {
    return playlist.ownerId === this.auth.currentUser()?.id;
  }

  toggleExpand(playlist: Playlist): void {
    if (this.expandedPlaylistId() === playlist.id) {
      this.expandedPlaylistId.set(null);
      return;
    }

    this.expandedPlaylistId.set(playlist.id);

    // Si les pistes complètes ne sont pas encore chargées, on fetch les détails
    if (!playlist.tracks || playlist.tracks.length < playlist.tracksCount) {
      this.loadingDetailsId.set(playlist.id);
      this.playlistService.getPlaylist(playlist.id).subscribe({
        next: (full) => {
          this.playlistService.playlists.update((list) =>
            list.map((p) => (p.id === full.id ? full : p))
          );
          this.loadingDetailsId.set(null);
        },
        error: () => {
          this.loadingDetailsId.set(null);
        },
      });
    }
  }

  // --- Lecture audio de la playlist ---

  playAll(playlist: Playlist, event?: Event): void {
    event?.stopPropagation();

    // S'assurer d'avoir les détails avec les pistes
    if (!playlist.tracks || playlist.tracks.length === 0) {
      this.snackBar.open('Cette playlist ne contient aucun morceau pour le moment', 'Fermer', {
        duration: 2500,
      });
      return;
    }

    const validTracks = playlist.tracks.filter((t) => typeof t === 'object' && t.id);
    if (validTracks.length === 0) {
      this.snackBar.open('Aucune piste disponible pour la lecture', 'Fermer', { duration: 2500 });
      return;
    }

    void this.player.playPlaylist(validTracks);
    this.snackBar.open(`Lecture de « ${playlist.name} » démarrée`, 'Fermer', { duration: 2500 });
  }

  addAllToQueue(playlist: Playlist, event?: Event): void {
    event?.stopPropagation();

    const validTracks = (playlist.tracks || []).filter(
      (t) => typeof t === 'object' && t.id
    );

    if (validTracks.length === 0) {
      this.snackBar.open('Cette playlist ne contient aucun morceau', 'Fermer', { duration: 2500 });
      return;
    }

    this.player.addMultipleToQueue(validTracks);
    this.snackBar.open(
      `${validTracks.length} morceau${validTracks.length > 1 ? 'x' : ''} ajouté${validTracks.length > 1 ? 's' : ''} à la file d'attente`,
      'Fermer',
      { duration: 2500 }
    );
  }

  playTrack(track: Track, event?: Event): void {
    event?.stopPropagation();
    if (this.player.currentTrack()?.id === track.id && this.player.isPlaying()) {
      this.player.pause();
    } else {
      void this.player.playTrack(track);
    }
  }

  removeTrack(playlist: Playlist, track: Track, event?: Event): void {
    event?.stopPropagation();
    this.playlistService.removeTrackFromPlaylist(playlist.id, track.id).subscribe({
      next: (updated) => {
        this.snackBar.open(`Morceau « ${track.title} » retiré de la playlist`, 'Fermer', {
          duration: 2500,
        });
      },
      error: () => {
        this.snackBar.open('Erreur lors du retrait du morceau', 'Fermer', { duration: 3000 });
      },
    });
  }

  // --- Création ---

  openCreateModal(): void {
    this.newPlaylistName = '';
    this.newPlaylistDesc = '';
    this.newPlaylistVisibility = 'public';
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  submitCreate(): void {
    const trimmed = this.newPlaylistName.trim();
    if (!trimmed) {
      this.snackBar.open('Le nom de la playlist est obligatoire', 'Fermer', { duration: 2500 });
      return;
    }

    this.creating.set(true);
    this.playlistService
      .createPlaylist({
        name: trimmed,
        description: this.newPlaylistDesc.trim(),
        visibility: this.newPlaylistVisibility,
      })
      .subscribe({
        next: (created) => {
          this.creating.set(false);
          this.showCreateModal.set(false);
          this.snackBar.open(`Playlist « ${created.name} » créée avec succès !`, 'Fermer', {
            duration: 2500,
          });
        },
        error: (err) => {
          this.creating.set(false);
          this.snackBar.open(
            err?.error?.message || 'Erreur lors de la création de la playlist',
            'Fermer',
            { duration: 3000 }
          );
        },
      });
  }

  // --- Édition ---

  openEdit(playlist: Playlist, event?: Event): void {
    event?.stopPropagation();
    this.editingPlaylist.set(playlist);
    this.editName = playlist.name;
    this.editDesc = playlist.description || '';
    this.editVisibility = playlist.visibility;
  }

  closeEdit(): void {
    this.editingPlaylist.set(null);
  }

  submitEdit(): void {
    const playlist = this.editingPlaylist();
    if (!playlist) return;

    const trimmed = this.editName.trim();
    if (!trimmed) {
      this.snackBar.open('Le nom de la playlist ne peut pas être vide', 'Fermer', {
        duration: 2500,
      });
      return;
    }

    this.updating.set(true);
    this.playlistService
      .updatePlaylist(playlist.id, {
        name: trimmed,
        description: this.editDesc.trim(),
        visibility: this.editVisibility,
      })
      .subscribe({
        next: (updated) => {
          this.updating.set(false);
          this.editingPlaylist.set(null);
          this.snackBar.open(`Playlist « ${updated.name} » mise à jour`, 'Fermer', {
            duration: 2500,
          });
        },
        error: (err) => {
          this.updating.set(false);
          this.snackBar.open(
            err?.error?.message || 'Erreur lors de la mise à jour',
            'Fermer',
            { duration: 3000 }
          );
        },
      });
  }

  // --- Suppression ---

  deletePlaylist(playlist: Playlist, event?: Event): void {
    event?.stopPropagation();
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement la playlist « ${playlist.name} » ?`)) {
      return;
    }

    this.deletingId.set(playlist.id);
    this.playlistService.deletePlaylist(playlist.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.expandedPlaylistId() === playlist.id) {
          this.expandedPlaylistId.set(null);
        }
        this.snackBar.open(`Playlist « ${playlist.name} » supprimée`, 'Fermer', { duration: 2500 });
      },
      error: () => {
        this.deletingId.set(null);
        this.snackBar.open('Erreur lors de la suppression de la playlist', 'Fermer', {
          duration: 3000,
        });
      },
    });
  }
}
