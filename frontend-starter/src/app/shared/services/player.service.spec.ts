import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlayerService } from './player.service';
import { AuthService } from './auth.service';
import { Track } from '../models/track.model';

describe('PlayerService', () => {
  let service: PlayerService;
  let authMock: Partial<AuthService>;

  beforeEach(() => {
    authMock = {
      token: signal('fake-jwt-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerService,
        { provide: AuthService, useValue: authMock },
      ],
    });

    service = TestBed.inject(PlayerService);
  });

  afterEach(() => {
    service.stop();
  });

  it('devrait être initialisé avec les valeurs par défaut', () => {
    expect(service).toBeTruthy();
    expect(service.isPlaying()).toBe(false);
    expect(service.currentTime()).toBe(0);
    expect(service.duration()).toBe(0);
    expect(service.progress()).toBe(0);
    expect(service.volume()).toBe(0.8);
    expect(service.isMuted()).toBe(false);
    expect(service.currentTrack()).toBeNull();
  });

  it('devrait mettre à jour le volume et le mute correctement', () => {
    service.setVolume(0.5);
    expect(service.volume()).toBe(0.5);
    expect(service.isMuted()).toBe(false);

    service.toggleMute();
    expect(service.volume()).toBe(0);
    expect(service.isMuted()).toBe(true);

    service.toggleMute();
    expect(service.volume()).toBe(0.5);
    expect(service.isMuted()).toBe(false);
  });

  it('devrait gérer le seeking découplé du slider', () => {
    // Simuler duration
    (service as any).duration.set(200);

    service.startSeeking();
    expect(service.isSeeking()).toBe(true);

    service.seekPercent(50);
    expect(service.progress()).toBe(50);
    expect(service.currentTime()).toBe(100);

    service.endSeeking();
    expect(service.isSeeking()).toBe(false);
    expect(service.currentTime()).toBe(100);
  });

  it('devrait formater correctement le temps en mm:ss', () => {
    (service as any).currentTime.set(65);
    (service as any).duration.set(185);

    expect(service.formattedCurrentTime()).toBe('1:05');
    expect(service.formattedDuration()).toBe('3:05');
  });

  it('devrait charger une piste et configurer l état de lecture', async () => {
    const dummyTrack: Track = {
      id: 'track1',
      ownerId: 'user1',
      title: 'Bleed It Out',
      originalName: 'bleed.mp3',
      mimeType: 'audio/mpeg',
      size: 5000000,
      visibility: 'public',
      likes: [],
      createdAt: '2026-01-01',
    };

    await service.playTrack(dummyTrack);

    expect(service.currentTrack()).toEqual(dummyTrack);
  });

  it('devrait réinitialiser l état lors de stop()', () => {
    service.stop();
    expect(service.currentTrack()).toBeNull();
    expect(service.isPlaying()).toBe(false);
    expect(service.currentTime()).toBe(0);
    expect(service.progress()).toBe(0);
  });
});
