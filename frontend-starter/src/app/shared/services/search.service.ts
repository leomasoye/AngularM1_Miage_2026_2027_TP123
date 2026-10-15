import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Track } from '../models/track.model';
import { User } from '../models/user.model';

export interface SearchResults {
  users: Pick<User, 'id' | 'name' | 'avatarUrl'>[];
  tracks: Track[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly http = inject(HttpClient);

  search(query: string, type: 'all' | 'tracks' | 'users' = 'all'): Observable<SearchResults> {
    const params = new HttpParams().set('q', query).set('type', type);
    return this.http.get<SearchResults>('/api/search', { params });
  }
}
