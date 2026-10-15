import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EqualizerComponent } from './equalizer.component';
import { PlayerService } from '../../shared/services/player.service';
import { AuthService } from '../../shared/services/auth.service';
import { signal } from '@angular/core';

describe('EqualizerComponent', () => {
  let component: EqualizerComponent;
  let fixture: ComponentFixture<EqualizerComponent>;
  let playerMock: Partial<PlayerService>;

  beforeEach(async () => {
    playerMock = {
      bass: signal(0),
      mid: signal(0),
      treble: signal(0),
      currentPreset: signal('flat' as any),
      reverbWet: signal(0),
      delayTime: signal(0.3),
      delayFeedback: signal(0),
      spatialPreset: signal('none' as any),
      isPlaying: signal(true),
      setBass: (db: number) => (playerMock.bass as any).set(db),
      setMid: (db: number) => (playerMock.mid as any).set(db),
      setTreble: (db: number) => (playerMock.treble as any).set(db),
      setPreset: (p: any) => (playerMock.currentPreset as any).set(p),
      setReverbWet: (v: number) => (playerMock.reverbWet as any).set(v),
      setDelayTime: (t: number) => (playerMock.delayTime as any).set(t),
      setDelayFeedback: (fb: number) => (playerMock.delayFeedback as any).set(fb),
      setSpatialPreset: (p: any) => (playerMock.spatialPreset as any).set(p),
      resetEQ: () => {
        (playerMock.bass as any).set(0);
        (playerMock.mid as any).set(0);
        (playerMock.treble as any).set(0);
        (playerMock.currentPreset as any).set('flat');
      },
      resetSpatialEffects: () => {
        (playerMock.reverbWet as any).set(0);
        (playerMock.delayTime as any).set(0.3);
        (playerMock.delayFeedback as any).set(0);
        (playerMock.spatialPreset as any).set('none');
      },
      getStereoVULevels: () => ({ left: 0.5, right: 0.6, leftPeak: 0.7, rightPeak: 0.8 }),
      getTimeDomainData: () => new Uint8Array(128).fill(128),
    };

    await TestBed.configureTestingModule({
      imports: [EqualizerComponent],
      providers: [
        { provide: PlayerService, useValue: playerMock },
        { provide: AuthService, useValue: { token: signal(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EqualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('devrait créer le composant égaliseur', () => {
    expect(component).toBeTruthy();
  });

  it('devrait sélectionner un preset d égaliseur', () => {
    component.selectPreset('bass-boost');
    expect(playerMock.currentPreset!()).toBe('bass-boost');
  });

  it('devrait réinitialiser l égaliseur', () => {
    component.selectPreset('vocal');
    component.reset();
    expect(playerMock.bass!()).toBe(0);
    expect(playerMock.currentPreset!()).toBe('flat');
  });

  it('devrait modifier les paramètres spatiaux et sélectionner un preset spatial', () => {
    component.selectSpatialPreset('hall');
    expect(playerMock.spatialPreset!()).toBe('hall');

    const reverbEvent = { target: { value: '45' } } as unknown as Event;
    component.onReverbChange(reverbEvent);
    expect(playerMock.reverbWet!()).toBe(0.45);

    const delayTimeEvent = { target: { value: '400' } } as unknown as Event;
    component.onDelayTimeChange(delayTimeEvent);
    expect(playerMock.delayTime!()).toBe(0.4);

    const delayFeedbackEvent = { target: { value: '50' } } as unknown as Event;
    component.onDelayFeedbackChange(delayFeedbackEvent);
    expect(playerMock.delayFeedback!()).toBe(0.5);
  });

  it('devrait réinitialiser tous les effets (EQ + Spatial) avec resetAll()', () => {
    component.selectPreset('electronic');
    component.selectSpatialPreset('stadium');
    component.resetAll();

    expect(playerMock.currentPreset!()).toBe('flat');
    expect(playerMock.spatialPreset!()).toBe('none');
    expect(playerMock.reverbWet!()).toBe(0);
  });
});
