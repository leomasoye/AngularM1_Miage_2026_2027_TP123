import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Friendship {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  friendId: string;
  friendName: string;
  isIncoming: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FriendsService {
  private readonly http = inject(HttpClient);
  private cachedFriends: Friendship[] | null = null;

  getCachedFriends(): Friendship[] | null {
    return this.cachedFriends;
  }

  invalidateCache(): void {
    this.cachedFriends = null;
  }

  getFriends(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>('/api/friends').pipe(
      tap((data) => {
        this.cachedFriends = data;
      })
    );
  }

  addFriend(addresseeId: string): Observable<Friendship> {
    this.invalidateCache();
    return this.http.post<Friendship>('/api/friends', { addresseeId });
  }

  updateStatus(id: string, status: 'accepted' | 'rejected'): Observable<Friendship> {
    return this.http.patch<Friendship>(`/api/friends/${id}/status`, { status }).pipe(
      tap((updated) => {
        if (this.cachedFriends) {
          this.cachedFriends = this.cachedFriends.map((f) => (f.id === updated.id ? { ...f, status: updated.status } : f));
        }
      })
    );
  }

  removeFriend(id: string): Observable<void> {
    return this.http.delete<void>(`/api/friends/${id}`).pipe(
      tap(() => {
        if (this.cachedFriends) {
          this.cachedFriends = this.cachedFriends.filter((f) => f.id !== id);
        }
      })
    );
  }

  getPending(): Observable<{ count: number; items: any[] }> {
    return this.http.get<{ count: number; items: any[] }>('/api/friends/pending');
  }
}

