import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  getFriends(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>('/api/friends');
  }

  addFriend(addresseeId: string): Observable<Friendship> {
    return this.http.post<Friendship>('/api/friends', { addresseeId });
  }

  updateStatus(id: string, status: 'accepted' | 'rejected'): Observable<Friendship> {
    return this.http.patch<Friendship>(`/api/friends/${id}/status`, { status });
  }

  removeFriend(id: string): Observable<void> {
    return this.http.delete<void>(`/api/friends/${id}`);
  }

  getPending(): Observable<{ count: number; items: any[] }> {
    return this.http.get<{ count: number; items: any[] }>('/api/friends/pending');
  }
}

