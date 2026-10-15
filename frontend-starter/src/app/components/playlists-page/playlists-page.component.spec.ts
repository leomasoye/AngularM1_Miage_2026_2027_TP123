import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaylistsPageComponent } from './playlists-page.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Playlist } from '../../shared/models/playlist.model';

describe('PlaylistsPageComponent', () => {
  let component: PlaylistsPageComponent;
  let fixture: ComponentFixture<PlaylistsPageComponent>;
  let httpMock: HttpTestingController;

  const mockPlaylists: Playlist[] = [
    {
      id: 'pl-1',
      name: 'Synthwave Night',
      description: 'Retro vibes',
      ownerId: 'user-1',
      ownerName: 'Chester',
      visibility: 'public',
      tracksCount: 2,
      tracks: [
        {
          id: 'track-1',
          title: 'Faint',
          originalName: 'faint.mp3',
          mimeType: 'audio/mpeg',
          size: 3500000,
          ownerId: 'user-1',
          visibility: 'public',
          likes: [],
          createdAt: '2026-01-01',
        },
      ],
      createdAt: '2026-01-01',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaylistsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlaylistsPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('devrait créer le composant et charger les playlists', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/playlists');
    expect(req.request.method).toBe('GET');
    req.flush(mockPlaylists);

    expect(component).toBeTruthy();
    expect(component.playlists().length).toBe(1);
    expect(component.filteredPlaylists().length).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('devrait filtrer les playlists par onglet', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/playlists');
    req.flush(mockPlaylists);

    component.setTab('public');
    expect(component.activeTab()).toBe('public');
    expect(component.filteredPlaylists().length).toBe(1);

    component.setTab('my');
    expect(component.activeTab()).toBe('my');
  });

  it('devrait ouvrir et fermer le modal de création', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/playlists');
    req.flush([]);

    expect(component.showCreateModal()).toBe(false);
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
    component.closeCreateModal();
    expect(component.showCreateModal()).toBe(false);
  });
});
