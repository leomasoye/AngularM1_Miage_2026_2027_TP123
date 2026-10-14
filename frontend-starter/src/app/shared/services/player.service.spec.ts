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

  it('devrait modifier les bandes de l égaliseur et appliquer les presets', () => {
    service.setBass(6);
    expect(service.bass()).toBe(6);
    expect(service.currentPreset()).toBe('custom');

    service.setMid(-3);
    expect(service.mid()).toBe(-3);

    service.setTreble(4);
    expect(service.treble()).toBe(4);

    service.setPreset('bass-boost');
    expect(service.bass()).toBe(7);
    expect(service.mid()).toBe(0);
    expect(service.treble()).toBe(-1);
    expect(service.currentPreset()).toBe('bass-boost');

    service.resetEQ();
    expect(service.bass()).toBe(0);
    expect(service.mid()).toBe(0);
    expect(service.treble()).toBe(0);
    expect(service.currentPreset()).toBe('flat');
  });

  it('devrait retourner les niveaux stéréo (VU-mètres)', () => {
    const levels = service.getStereoVULevels();
    expect(levels).toBeDefined();
    expect(levels.left).toBeGreaterThanOrEqual(0);
    expect(levels.right).toBeGreaterThanOrEqual(0);
  });

  it('devrait gérer la file d attente (addToQueue, removeFromQueue, clearQueue)', () => {
    const track1: Track = {
      id: 't1',
      ownerId: 'u1',
      title: 'Track 1',
      originalName: '1.mp3',
      mimeType: 'audio/mpeg',
      size: 1000,
      visibility: 'public',
      likes: [],
      createdAt: '2026-01-01',
    };
    const track2: Track = {
      id: 't2',
      ownerId: 'u1',
      title: 'Track 2',
      originalName: '2.mp3',
      mimeType: 'audio/mpeg',
      size: 2000,
      visibility: 'public',
      likes: [],
      createdAt: '2026-01-01',
    };

    expect(service.queue().length).toBe(0);

    service.addToQueue(track1);
    service.addToQueue(track2);
    expect(service.queue().length).toBe(2);
    expect(service.queue()[0].id).toBe('t1');

    service.removeFromQueue(0);
    expect(service.queue().length).toBe(1);
    expect(service.queue()[0].id).toBe('t2');

    service.clearQueue();
    expect(service.queue().length).toBe(0);
  });

  it('devrait basculer le mode shuffle et repeat', () => {
    expect(service.isShuffle()).toBe(false);
    service.toggleShuffle();
    expect(service.isShuffle()).toBe(true);

    expect(service.repeatMode()).toBe('none');
    service.toggleRepeat();
    expect(service.repeatMode()).toBe('all');
    service.toggleRepeat();
    expect(service.repeatMode()).toBe('one');
    service.toggleRepeat();
    expect(service.repeatMode()).toBe('none');
  });

  it('devrait passer au morceau suivant de la queue avec playNext()', async () => {
    const track1: Track = {
      id: 't1',
      ownerId: 'u1',
      title: 'Track 1',
      originalName: '1.mp3',
      mimeType: 'audio/mpeg',
      size: 1000,
      visibility: 'public',
      likes: [],
      createdAt: '2026-01-01',
    };
    const track2: Track = {
      id: 't2',
      ownerId: 'u1',
      title: 'Track 2',
      originalName: '2.mp3',
      mimeType: 'audio/mpeg',
      size: 2000,
      visibility: 'public',
      likes: [],
      createdAt: '2026-01-01',
    };

    await service.playTrack(track1);
    service.addToQueue(track2);

    expect(service.currentTrack()?.id).toBe('t1');
    expect(service.queue().length).toBe(1);

    await service.playNext();

    expect(service.currentTrack()?.id).toBe('t2');
    expect(service.queue().length).toBe(0);
    expect(service.history().length).toBe(1);
    expect(service.history()[0].id).toBe('t1');
  });
});


