import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
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
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
  });

  it('devrait initialiser avec le thème From Zero par défaut', () => {
    expect(service.currentThemeId()).toBe('from-zero');
    expect(service.currentTheme().name).toBe('From Zero');
    expect(service.themes.length).toBeGreaterThanOrEqual(7);
  });

  it('devrait changer de thème et mettre à jour le signal currentTheme', () => {
    service.setTheme('cyberpunk');
    expect(service.currentThemeId()).toBe('cyberpunk');
    expect(service.currentTheme().name).toBe('Cyberpunk Neon');

    service.setTheme('emerald');
    expect(service.currentThemeId()).toBe('emerald');
    expect(service.currentTheme().name).toBe('Emerald Matrix');
  });

  it('devrait modifier la visibilité par défaut des morceaux', () => {
    expect(service.defaultTrackVisibility()).toBe('public');
    service.setDefaultTrackVisibility('private');
    expect(service.defaultTrackVisibility()).toBe('private');
  });

  it('devrait modifier le volume par défaut et le borner entre 0 et 1', () => {
    service.setDefaultVolume(0.5);
    expect(service.defaultVolume()).toBe(0.5);

    service.setDefaultVolume(-0.2);
    expect(service.defaultVolume()).toBe(0);

    service.setDefaultVolume(1.5);
    expect(service.defaultVolume()).toBe(1);
  });

  it('devrait réinitialiser toutes les préférences aux valeurs par défaut', () => {
    service.setTheme('sunset');
    service.setDefaultTrackVisibility('private');
    service.setAutoPlayNext(false);
    service.setDefaultVolume(0.3);

    service.resetToDefaults();

    expect(service.currentThemeId()).toBe('from-zero');
    expect(service.defaultTrackVisibility()).toBe('public');
    expect(service.autoPlayNext()).toBe(true);
    expect(service.defaultVolume()).toBe(0.8);
  });

  it('devrait sauvegarder les préférences dans localStorage', () => {
    service.setTheme('amethyst');
    service.setDefaultTrackVisibility('private');

    const stored = JSON.parse(store['from_zero_preferences'] || '{}');
    expect(stored.theme).toBe('amethyst');
    expect(stored.defaultTrackVisibility).toBe('private');
  });
});
