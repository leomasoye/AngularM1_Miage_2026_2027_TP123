import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioReactiveGlowComponent } from './audio-reactive-glow.component';
import { PlayerService } from '../../shared/services/player.service';
import { GlowService } from '../../shared/services/glow.service';
import { signal } from '@angular/core';

describe('AudioReactiveGlowComponent', () => {
  let component: AudioReactiveGlowComponent;
  let fixture: ComponentFixture<AudioReactiveGlowComponent>;
  let playerMock: Partial<PlayerService>;

  beforeEach(async () => {
    playerMock = {
      isPlaying: signal(false),
      getFrequencyData: () => new Uint8Array([200, 180, 150, 120, 100, 80, 60]),
    };

    await TestBed.configureTestingModule({
      imports: [AudioReactiveGlowComponent],
      providers: [
        { provide: PlayerService, useValue: playerMock },
        GlowService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioReactiveGlowComponent);
    component = fixture.componentInstance;
  });

  it('devrait créer le composant de halo audio-réactif', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('devrait posséder une référence sur le canvas de rendu', () => {
    fixture.detectChanges();
    expect(component.canvasRef()).toBeTruthy();
  });
});
