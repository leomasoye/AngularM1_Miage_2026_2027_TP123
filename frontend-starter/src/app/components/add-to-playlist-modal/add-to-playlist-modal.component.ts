import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlaylistService } from '../../shared/services/playlist.service';
import { Track } from '../../shared/models/track.model';
import { Playlist } from '../../shared/models/playlist.model';

export interface AddToPlaylistModalData {
  track: Track;
}

@Component({
  selector: 'app-add-to-playlist-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './add-to-playlist-modal.component.html',
  styleUrl: './add-to-playlist-modal.component.css',
})
export class AddToPlaylistModalComponent implements OnInit {
  readonly data: AddToPlaylistModalData = inject(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AddToPlaylistModalComponent>);
  private readonly playlistService = inject(PlaylistService);
  private readonly snackBar = inject(MatSnackBar);

  readonly loading = signal<boolean>(true);
  readonly savingPlaylistId = signal<string | null>(null);
  readonly playlists = signal<Playlist[]>([]);

  readonly showCreateForm = signal<boolean>(false);
  newPlaylistName = '';
  newPlaylistVisibility: 'public' | 'private' = 'public';
  readonly creating = signal<boolean>(false);

  ngOnInit(): void {
    this.loadPlaylists();
  }

  loadPlaylists(): void {
    this.loading.set(true);
    this.playlistService.loadPlaylists('my').subscribe({
      next: (items) => {
        this.playlists.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.snackBar.open('Erreur de chargement de vos playlists', 'Fermer', {
          duration: 3000,
        });
        this.loading.set(false);
      },
    });
  }

  isTrackInPlaylist(playlist: Playlist): boolean {
    if (!playlist.tracks || !Array.isArray(playlist.tracks)) return false;
    return playlist.tracks.some(
      (t) => (typeof t === 'string' ? t : t?.id) === this.data.track.id
    );
  }

  toggleTrackInPlaylist(playlist: Playlist): void {
    const inPlaylist = this.isTrackInPlaylist(playlist);
    this.savingPlaylistId.set(playlist.id);

    if (inPlaylist) {
      this.playlistService.removeTrackFromPlaylist(playlist.id, this.data.track.id).subscribe({
        next: (updated) => {
          this.playlists.update((list) =>
            list.map((p) => (p.id === playlist.id ? updated : p))
          );
          this.savingPlaylistId.set(null);
          this.snackBar.open(`Piste retirée de « ${playlist.name} »`, 'Fermer', {
            duration: 2500,
          });
        },
        error: () => {
          this.savingPlaylistId.set(null);
          this.snackBar.open('Erreur lors du retrait de la piste', 'Fermer', {
            duration: 3000,
          });
        },
      });
    } else {
      this.playlistService.addTrackToPlaylist(playlist.id, this.data.track.id).subscribe({
        next: (updated) => {
          this.playlists.update((list) =>
            list.map((p) => (p.id === playlist.id ? updated : p))
          );
          this.savingPlaylistId.set(null);
          this.snackBar.open(`Piste ajoutée à « ${playlist.name} »`, 'Fermer', {
            duration: 2500,
          });
        },
        error: () => {
          this.savingPlaylistId.set(null);
          this.snackBar.open("Erreur lors de l'ajout à la playlist", 'Fermer', {
            duration: 3000,
          });
        },
      });
    }
  }

  createAndAddPlaylist(): void {
    const trimmed = this.newPlaylistName.trim();
    if (!trimmed) {
      this.snackBar.open('Veuillez saisir un nom de playlist', 'Fermer', { duration: 2500 });
      return;
    }

    this.creating.set(true);
    this.playlistService
      .createPlaylist({
        name: trimmed,
        visibility: this.newPlaylistVisibility,
      })
      .subscribe({
        next: (created) => {
          // Ajouter directement la piste à la playlist nouvellement créée
          this.playlistService.addTrackToPlaylist(created.id, this.data.track.id).subscribe({
            next: (updated) => {
              this.playlists.update((list) => [
                updated,
                ...list.filter((p) => p.id !== created.id),
              ]);
              this.newPlaylistName = '';
              this.showCreateForm.set(false);
              this.creating.set(false);
              this.snackBar.open(`Playlist « ${updated.name} » créée avec la piste`, 'Fermer', {
                duration: 2500,
              });
            },
            error: () => {
              this.creating.set(false);
            },
          });
        },
        error: () => {
          this.creating.set(false);
          this.snackBar.open('Erreur lors de la création de la playlist', 'Fermer', {
            duration: 3000,
          });
        },
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
