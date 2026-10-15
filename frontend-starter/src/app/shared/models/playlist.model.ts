import { Track } from './track.model';

export interface Playlist {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName?: string;
  ownerAvatarUrl?: string | null;
  visibility: 'public' | 'private';
  tracksCount: number;
  tracks: Track[];
  sharedWith?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePlaylistDto {
  name: string;
  description?: string;
  visibility?: 'public' | 'private';
}

export interface UpdatePlaylistDto {
  name?: string;
  description?: string;
  visibility?: 'public' | 'private';
}
