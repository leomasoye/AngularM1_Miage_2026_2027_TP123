import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddToPlaylistModalComponent } from './add-to-playlist-modal.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Track } from '../../shared/models/track.model';
import { Playlist } from '../../shared/models/playlist.model';

describe('AddToPlaylistModalComponent', () => {
  let component: AddToPlaylistModalComponent;
  let fixture: ComponentFixture<AddToPlaylistModalComponent>;
  let httpMock: HttpTestingController;

  const mockTrack: Track = {
    id: 'track-10',
    title: 'Numb',
    originalName: 'numb.mp3',
    mimeType: 'audio/mpeg',
    size: 4000000,
    ownerId: 'user-1',
    visibility: 'public',
    likes: [],
    createdAt: '2026-01-01',
  };

  const mockPlaylists: Playlist[] = [
    {
      id: 'pl-10',
      name: 'Meteora Favorites',
      description: 'Album gems',
      ownerId: 'user-1',
      visibility: 'public',
      tracksCount: 1,
      tracks: [mockTrack],
      createdAt: '2026-01-01',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddToPlaylistModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { track: mockTrack },
        },
        {
          provide: MatDialogRef,
          useValue: { close: () => {} },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddToPlaylistModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait créer le composant et charger les playlists', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/playlists?filter=my');
    expect(req.request.method).toBe('GET');
    req.flush(mockPlaylists);

    expect(component).toBeTruthy();
    expect(component.playlists().length).toBe(1);
    expect(component.isTrackInPlaylist(mockPlaylists[0])).toBe(true);
  });

  it('devrait basculer l état d une piste dans une playlist', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/playlists?filter=my');
    req.flush(mockPlaylists);

    // Track is already in playlist -> toggle should remove it
    component.toggleTrackInPlaylist(mockPlaylists[0]);
    const delReq = httpMock.expectOne('/api/playlists/pl-10/tracks/track-10');
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ ...mockPlaylists[0], tracks: [], tracksCount: 0 });

    expect(component.playlists()[0].tracksCount).toBe(0);
  });
});
