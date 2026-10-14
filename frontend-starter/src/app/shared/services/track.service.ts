import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);
  private cachedPage: Page<Track> | null = null;
  private cachedPageKey = '';

  getCached(page: number, limit: number): Page<Track> | null {
    if (this.cachedPageKey === `${page}:${limit}`) {
      return this.cachedPage;
    }
    return null;
  }

  invalidateCache(): void {
    this.cachedPage = null;
    this.cachedPageKey = '';
  }

  list(page = 1, limit = 5) {
    const key = `${page}:${limit}`;
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    }).pipe(
      tap((res) => {
        this.cachedPage = res;
        this.cachedPageKey = key;
      })
    );
  }

  upload(file: File, title: string) {
    this.invalidateCache();
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true,
      observe: 'events'
    });
  }

  delete(id: string): Observable<void> {
    this.invalidateCache();
    return this.http.delete<void>(`/api/tracks/${id}`);
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  updateVisibility(id: string, visibility: 'public' | 'private'): Observable<Track> {
    return this.http.patch<Track>(`/api/tracks/${id}/visibility`, { visibility });
  }

  like(id: string): Observable<Track> {
    return this.http.post<Track>(`/api/tracks/${id}/like`, {});
  }

  unlike(id: string): Observable<Track> {
    return this.http.delete<Track>(`/api/tracks/${id}/like`);
  }
}
