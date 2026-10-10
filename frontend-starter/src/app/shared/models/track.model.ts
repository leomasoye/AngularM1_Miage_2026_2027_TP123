/** Audio track metadata returned by the API. */
export interface Track {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  ownerId: string;
  ownerName?: string;
  visibility: 'public' | 'private';
  likes: string[];
  createdAt: string;
}
