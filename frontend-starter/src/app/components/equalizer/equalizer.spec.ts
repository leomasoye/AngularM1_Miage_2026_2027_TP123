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
      isPlaying: signal(true),
      setBass: (db: number) => (playerMock.bass as any).set(db),
      setMid: (db: number) => (playerMock.mid as any).set(db),
      setTreble: (db: number) => (playerMock.treble as any).set(db),
      setPreset: (p: any) => (playerMock.currentPreset as any).set(p),
      resetEQ: () => {
        (playerMock.bass as any).set(0);
        (playerMock.mid as any).set(0);
        (playerMock.treble as any).set(0);
        (playerMock.currentPreset as any).set('flat');
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

  it('devrait sélectionner un preset', () => {
    component.selectPreset('bass-boost');
    expect(playerMock.currentPreset!()).toBe('bass-boost');
  });

  it('devrait réinitialiser l égaliseur', () => {
    component.selectPreset('vocal');
    component.reset();
    expect(playerMock.bass!()).toBe(0);
    expect(playerMock.currentPreset!()).toBe('flat');
  });
});
