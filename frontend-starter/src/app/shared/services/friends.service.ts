import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private readonly apiUrl = `${environment.apiUrl}/friends`;

  getFriends(): Observable<Friendship[]> {
    return this.http.get<Friendship[]>(this.apiUrl);
  }

  addFriend(addresseeId: string): Observable<Friendship> {
    return this.http.post<Friendship>(this.apiUrl, { addresseeId });
  }

  updateStatus(id: string, status: 'accepted' | 'rejected'): Observable<Friendship> {
    return this.http.patch<Friendship>(`${this.apiUrl}/${id}/status`, { status });
  }

  removeFriend(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
