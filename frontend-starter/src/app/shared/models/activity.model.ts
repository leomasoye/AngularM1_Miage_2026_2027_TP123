import { Track } from "./track.model";

export interface ActivityTrack extends Track {
  isShared?: boolean;
}

export interface ActivityFeedResponse {
  items: ActivityTrack[];
  hasMore: boolean;
  nextCursor: string | null;
}
