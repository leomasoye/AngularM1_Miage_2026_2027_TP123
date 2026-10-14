import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerBarComponent } from './player-bar.component';
import { PlayerService } from '../../shared/services/player.service';
import { AuthService } from '../../shared/services/auth.service';
import { Track } from '../../shared/models/track.model';
import { signal } from '@angular/core';

describe('PlayerBarComponent', () => {
  let component: PlayerBarComponent;
  let fixture: ComponentFixture<PlayerBarComponent>;
  let playerMock: Partial<PlayerService>;
  let authMock: Partial<AuthService>;

  const mockTrack: Track = {
    id: 'track123',
    ownerId: 'user1',
    title: 'From Zero',
    originalName: 'from_zero.mp3',
    mimeType: 'audio/mpeg',
    size: 4000000,
    visibility: 'public',
    likes: [],
    createdAt: '2026-01-01',
  };

  beforeEach(async () => {
    playerMock = {
      currentTrack: signal<Track | null>(mockTrack),
      isPlaying: signal(false),
      currentTime: signal(10),
      duration: signal(100),
      progress: signal(10),
      volume: signal(0.8),
      isMuted: signal(false),
      isLoading: signal(false),
      formattedCurrentTime: signal('0:10'),
      formattedDuration: signal('1:40'),
      startSeeking: () => {},
      seekPercent: () => {},
      endSeeking: () => {},
      setVolume: () => {},
      togglePlay: async () => {},
      toggleMute: () => {},
      getFrequencyData: () => new Uint8Array(128),
      getStereoVULevels: () => ({ left: 0.5, right: 0.5, leftPeak: 0.6, rightPeak: 0.6 }),
    };

    authMock = {
      currentUser: signal({ id: 'user1', name: 'User', email: 'user@test.com', createdAt: '2026-01-01' }),
      token: signal('fake-token'),
    };

    await TestBed.configureTestingModule({
      imports: [PlayerBarComponent],
      providers: [
        { provide: PlayerService, useValue: playerMock },
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait créer le composant player-bar', () => {
    expect(component).toBeTruthy();
  });

  it('devrait afficher le titre de la piste courante', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titleEl = el.querySelector('.track-title');
    expect(titleEl?.textContent).toContain('From Zero');
  });

  it('devrait appeler togglePlay lors du clic sur le bouton play/pause', async () => {
    let playToggled = false;
    playerMock.togglePlay = async () => {
      playToggled = true;
    };

    const playBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-play-pause');
    playBtn.click();
    expect(playToggled).toBe(true);
  });
});
