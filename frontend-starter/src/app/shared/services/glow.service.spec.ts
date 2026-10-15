import { TestBed } from '@angular/core/testing';
import { GlowService } from './glow.service';

describe('GlowService', () => {
  let service: GlowService;
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = String(val);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [GlowService],
    });
    service = TestBed.inject(GlowService);
  });

  it('devrait initialiser les valeurs par défaut', () => {
    expect(service.isEnabled()).toBe(true);
    expect(service.intensity()).toBe(1.0);
    expect(service.particlesEnabled()).toBe(true);
  });

  it('devrait basculer l état actif de l ambiance audio-réactive', () => {
    expect(service.isEnabled()).toBe(true);
    service.toggleGlow();
    expect(service.isEnabled()).toBe(false);
    service.toggleGlow();
    expect(service.isEnabled()).toBe(true);
  });

  it('devrait définir l intensité et borner les valeurs extrêmes', () => {
    service.setIntensity(1.5);
    expect(service.intensity()).toBe(1.5);

    // Borne basse 0.2
    service.setIntensity(0.05);
    expect(service.intensity()).toBe(0.2);

    // Borne haute 2.0
    service.setIntensity(3.5);
    expect(service.intensity()).toBe(2.0);
  });

  it('devrait basculer l état des particules', () => {
    expect(service.particlesEnabled()).toBe(true);
    service.toggleParticles();
    expect(service.particlesEnabled()).toBe(false);
  });

  it('devrait persister les réglages dans le localStorage', () => {
    service.setGlowEnabled(false);
    service.setIntensity(1.2);

    const stored = JSON.parse(store['from_zero_reactive_glow'] || '{}');
    expect(stored.isEnabled).toBe(false);
    expect(stored.intensity).toBe(1.2);
  });
});
