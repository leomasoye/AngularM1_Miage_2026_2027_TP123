import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { Share, TrackShareUser } from "../models/share.model";
import { Track } from "../models/track.model";

@Injectable({
  providedIn: "root",
})
export class ShareService {
  private readonly http = inject(HttpClient);

  getSharesForTrack(trackId: string): Observable<TrackShareUser[]> {
    return this.http.get<TrackShareUser[]>(`/api/tracks/${trackId}/shares`);
  }

  shareTrack(trackId: string, userId: string): Observable<Share> {
    return this.http.post<Share>(`/api/tracks/${trackId}/share/${userId}`, {});
  }

  unshareTrack(trackId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`/api/tracks/${trackId}/share/${userId}`);
  }

  getSharedWithMe(): Observable<Track[]> {
    return this.http.get<Track[]>("/api/tracks/shared");
  }
}
