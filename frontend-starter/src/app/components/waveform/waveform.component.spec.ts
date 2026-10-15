import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaveformComponent } from './waveform.component';
import { PlayerService } from '../../shared/services/player.service';
import { signal } from '@angular/core';

describe('WaveformComponent', () => {
  let component: WaveformComponent;
  let fixture: ComponentFixture<WaveformComponent>;
  let playerMock: Partial<PlayerService>;

  let seekStartCalled = false;
  let lastSeekPercent: number | null = null;
  let seekEndCalled = false;
  let togglePlayCalled = false;

  beforeEach(async () => {
    seekStartCalled = false;
    lastSeekPercent = null;
    seekEndCalled = false;
    togglePlayCalled = false;

    playerMock = {
      progress: signal(25),
      currentTime: signal(30),
      duration: signal(120),
      isPlaying: signal(false),
      waveformPeaks: signal([0.2, 0.5, 0.8, 0.4, 0.9, 0.3]),
      isWaveformLoading: signal(false),
      formattedCurrentTime: signal('0:30'),
      formattedDuration: signal('2:00'),
      startSeeking: () => {
        seekStartCalled = true;
      },
      seekPercent: (pct: number) => {
        lastSeekPercent = pct;
      },
      endSeeking: (_pct?: number) => {
        seekEndCalled = true;
      },
      togglePlay: async () => {
        togglePlayCalled = true;
      },
      generateFallbackPeaks: (bars = 120) => new Array(bars).fill(0.5),
    };

    await TestBed.configureTestingModule({
      imports: [WaveformComponent],
      providers: [{ provide: PlayerService, useValue: playerMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(WaveformComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('devrait créer le composant WaveformComponent', () => {
    expect(component).toBeTruthy();
    expect(component.canvasRef()?.nativeElement).toBeTruthy();
  });

  it('devrait dessiner la forme d onde sans erreur', () => {
    expect(() => component.drawWaveform()).not.toThrow();
  });

  it('devrait calculer le survol et formater le hoverTime', () => {
    const wrapper = component.wrapperRef()?.nativeElement;
    if (wrapper) {
      wrapper.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          width: 200,
          height: 40,
          right: 200,
          bottom: 40,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect);
    }

    const mouseEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 20 });
    component.onMouseMove(mouseEvent);

    expect(component.hoverPercent()).toBe(50);
    // 50% de 120s = 60s -> '1:00'
    expect(component.hoverTimeFormatted()).toBe('1:00');
  });

  it('devrait démarrer le seeking lors du mousedown', () => {
    const wrapper = component.wrapperRef()?.nativeElement;
    if (wrapper) {
      wrapper.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          width: 100,
          height: 40,
          right: 100,
          bottom: 40,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect);
    }

    const mouseEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 20 });
    component.onMouseDown(mouseEvent);

    expect(seekStartCalled).toBe(true);
    expect(lastSeekPercent).toBe(50);
  });

  it('devrait supporter la navigation au clavier (Flèches gauche/droite, Home, End, Espace)', () => {
    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    component.onKeyDown(leftEvent);
    expect(seekEndCalled).toBe(true);

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    component.onKeyDown(spaceEvent);
    expect(togglePlayCalled).toBe(true);
  });
});
