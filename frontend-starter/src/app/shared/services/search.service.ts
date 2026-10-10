import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Track } from '../models/track.model';
import { environment } from '../../../environments/environment';
import { User } from './auth.service';

export interface SearchResults {
  users: User[];
  tracks: Track[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/search`;

  search(query: string, type: 'all' | 'tracks' | 'users' = 'all'): Observable<SearchResults> {
    let params = new HttpParams().set('q', query).set('type', type);
    return this.http.get<SearchResults>(this.apiUrl, { params });
  }
}
