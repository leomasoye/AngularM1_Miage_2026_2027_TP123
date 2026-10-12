export interface Share {
  id: string;
  trackId: string;
  ownerId: string;
  sharedWithId: string;
  createdAt: string;
}

export interface TrackShareUser {
  id: string;
  userId: string;
  userName: string;
  createdAt: string;
}
