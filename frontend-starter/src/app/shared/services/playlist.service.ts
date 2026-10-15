import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { CreatePlaylistDto, Playlist, UpdatePlaylistDto } from '../models/playlist.model';

@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private readonly http = inject(HttpClient);

  readonly playlists = signal<Playlist[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Charge la liste des playlists (optionnellement filtrée par 'my', 'public', etc.).
   */
  loadPlaylists(filter?: string): Observable<Playlist[]> {
    this.loading.set(true);
    this.error.set(null);

    const url = filter ? `/api/playlists?filter=${filter}` : '/api/playlists';

    return this.http.get<Playlist[]>(url).pipe(
      tap({
        next: (items) => {
          this.playlists.set(items);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Erreur lors du chargement des playlists');
          this.loading.set(false);
        },
      })
    );
  }

  /**
   * Récupère une playlist spécifique avec toutes ses pistes associées.
   */
  getPlaylist(id: string): Observable<Playlist> {
    return this.http.get<Playlist>(`/api/playlists/${id}`);
  }

  /**
   * Crée une nouvelle playlist.
   */
  createPlaylist(dto: CreatePlaylistDto): Observable<Playlist> {
    return this.http.post<Playlist>('/api/playlists', dto).pipe(
      tap({
        next: (created) => {
          this.playlists.update((list) => [created, ...list]);
        },
      })
    );
  }

  /**
   * Met à jour une playlist existante (nom, description, visibilité).
   */
  updatePlaylist(id: string, dto: UpdatePlaylistDto): Observable<Playlist> {
    return this.http.patch<Playlist>(`/api/playlists/${id}`, dto).pipe(
      tap({
        next: (updated) => {
          this.playlists.update((list) =>
            list.map((p) => (p.id === id ? { ...p, ...updated } : p))
          );
        },
      })
    );
  }

  /**
   * Supprime une playlist.
   */
  deletePlaylist(id: string): Observable<void> {
    return this.http.delete<void>(`/api/playlists/${id}`).pipe(
      tap({
        next: () => {
          this.playlists.update((list) => list.filter((p) => p.id !== id));
        },
      })
    );
  }

  /**
   * Ajoute une piste à une playlist.
   */
  addTrackToPlaylist(playlistId: string, trackId: string): Observable<Playlist> {
    return this.http.post<Playlist>(`/api/playlists/${playlistId}/tracks/${trackId}`, {}).pipe(
      tap({
        next: (updated) => {
          this.playlists.update((list) =>
            list.map((p) => (p.id === playlistId ? { ...p, ...updated } : p))
          );
        },
      })
    );
  }

  /**
   * Retire une piste d'une playlist.
   */
  removeTrackFromPlaylist(playlistId: string, trackId: string): Observable<Playlist> {
    return this.http.delete<Playlist>(`/api/playlists/${playlistId}/tracks/${trackId}`).pipe(
      tap({
        next: (updated) => {
          this.playlists.update((list) =>
            list.map((p) => (p.id === playlistId ? { ...p, ...updated } : p))
          );
        },
      })
    );
  }
}
