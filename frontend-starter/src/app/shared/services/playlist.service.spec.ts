import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PlaylistService } from './playlist.service';
import { Playlist } from '../models/playlist.model';

describe('PlaylistService', () => {
  let service: PlaylistService;
  let httpMock: HttpTestingController;

  const mockPlaylist: Playlist = {
    id: 'pl-1',
    name: 'Rock Classics',
    description: 'Best guitar tracks',
    ownerId: 'user-1',
    ownerName: 'Alice',
    visibility: 'public',
    tracksCount: 1,
    tracks: [
      {
        id: 'track-1',
        title: 'In The End',
        originalName: 'in_the_end.mp3',
        mimeType: 'audio/mpeg',
        size: 5000000,
        ownerId: 'user-1',
        visibility: 'public',
        likes: [],
        createdAt: '2026-01-01',
      },
    ],
    createdAt: '2026-01-01',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlaylistService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PlaylistService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait charger les playlists et mettre à jour le signal playlists', () => {
    let result: Playlist[] = [];
    service.loadPlaylists().subscribe((items) => {
      result = items;
    });

    const req = httpMock.expectOne('/api/playlists');
    expect(req.request.method).toBe('GET');
    req.flush([mockPlaylist]);

    expect(result.length).toBe(1);
    expect(service.playlists().length).toBe(1);
    expect(service.playlists()[0].name).toBe('Rock Classics');
    expect(service.loading()).toBe(false);
  });

  it('devrait créer une playlist et l ajouter en tête de signal', () => {
    service.playlists.set([]);

    let created: Playlist | undefined;
    service
      .createPlaylist({ name: 'New Playlist', visibility: 'public' })
      .subscribe((res) => {
        created = res;
      });

    const req = httpMock.expectOne('/api/playlists');
    expect(req.request.method).toBe('POST');
    req.flush({ ...mockPlaylist, id: 'pl-new', name: 'New Playlist' });

    expect(created?.name).toBe('New Playlist');
    expect(service.playlists().length).toBe(1);
    expect(service.playlists()[0].id).toBe('pl-new');
  });

  it('devrait mettre à jour une playlist existante', () => {
    service.playlists.set([mockPlaylist]);

    service
      .updatePlaylist('pl-1', { name: 'Updated Name' })
      .subscribe();

    const req = httpMock.expectOne('/api/playlists/pl-1');
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...mockPlaylist, name: 'Updated Name' });

    expect(service.playlists()[0].name).toBe('Updated Name');
  });

  it('devrait supprimer une playlist du signal', () => {
    service.playlists.set([mockPlaylist]);

    service.deletePlaylist('pl-1').subscribe();

    const req = httpMock.expectOne('/api/playlists/pl-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.playlists().length).toBe(0);
  });

  it('devrait ajouter et retirer une piste d une playlist', () => {
    service.playlists.set([mockPlaylist]);

    // Add track
    service.addTrackToPlaylist('pl-1', 'track-2').subscribe();
    const reqAdd = httpMock.expectOne('/api/playlists/pl-1/tracks/track-2');
    expect(reqAdd.request.method).toBe('POST');
    reqAdd.flush({ ...mockPlaylist, tracksCount: 2 });
    expect(service.playlists()[0].tracksCount).toBe(2);

    // Remove track
    service.removeTrackFromPlaylist('pl-1', 'track-2').subscribe();
    const reqRem = httpMock.expectOne('/api/playlists/pl-1/tracks/track-2');
    expect(reqRem.request.method).toBe('DELETE');
    reqRem.flush({ ...mockPlaylist, tracksCount: 1 });
    expect(service.playlists()[0].tracksCount).toBe(1);
  });
});
