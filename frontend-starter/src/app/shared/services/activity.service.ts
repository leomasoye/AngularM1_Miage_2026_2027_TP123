import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ActivityFeedResponse } from "../models/activity.model";

@Injectable({
  providedIn: "root",
})
export class ActivityService {
  private readonly http = inject(HttpClient);
  private cachedFeed: ActivityFeedResponse | null = null;

  getCachedActivity(): ActivityFeedResponse | null {
    return this.cachedFeed;
  }

  getActivity(before?: string, limit = 20): Observable<ActivityFeedResponse> {
    let params = new HttpParams().set("limit", limit.toString());
    if (before) {
      params = params.set("before", before);
    }
    return this.http.get<ActivityFeedResponse>("/api/activity", { params }).pipe(
      tap((res) => {
        if (!before) {
          this.cachedFeed = res;
        }
      })
    );
  }
}
