import { computed, effect, Injectable, signal } from '@angular/core';
import { AppPreferences, ColorTheme, ThemeId } from '../models/theme.model';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly STORAGE_KEY = 'from_zero_preferences';

  readonly themes: readonly ColorTheme[] = [
    {
      id: 'from-zero',
      name: 'From Zero',
      subtitle: 'Signature Linkin Park',
      description:
        "L'ambiance originale de l'album 2024 : orchidée vibrante, bleu électrique et fond charbon profond.",
      primaryColor: '#9b3fd4',
      secondaryColor: '#1a7fe8',
      voidColor: '#0d0d0f',
      surfaceColor: '#13131a',
      gradient: 'linear-gradient(135deg, #9b3fd4 0%, #1a7fe8 100%)',
      icon: 'album',
      tags: ['Signature', 'Organique', 'Kintsugi'],
    },
    {
      id: 'cyberpunk',
      name: 'Cyberpunk Neon',
      subtitle: 'Haute intensité & Contrastes',
      description:
        'Vibe futuriste aux contrastes saisissants combinant rose magenta percutant et cyan néon.',
      primaryColor: '#ff007f',
      secondaryColor: '#00f0ff',
      voidColor: '#09060f',
      surfaceColor: '#130d22',
      gradient: 'linear-gradient(135deg, #ff007f 0%, #00f0ff 100%)',
      icon: 'bolt',
      tags: ['Futuriste', 'Néon', 'Synthwave'],
    },
    {
      id: 'emerald',
      name: 'Emerald Matrix',
      subtitle: 'Lueur bio-organique & Jade',
      description:
        'Énergie sombre et verdoyante inspirée du code matriciel, vert émeraude et menthe lumineuse.',
      primaryColor: '#10b981',
      secondaryColor: '#00e676',
      voidColor: '#060e0a',
      surfaceColor: '#0b1812',
      gradient: 'linear-gradient(135deg, #10b981 0%, #00e676 100%)',
      icon: 'forest',
      tags: ['Matrice', 'Émeraude', 'Zen'],
    },
    {
      id: 'sunset',
      name: 'Sunset Horizon',
      subtitle: 'Meteora & Hunting Party',
      description:
        'Teintes chaudes incandescentes : rouge carmin tranchant, ambre doré et atmosphère incendiaire.',
      primaryColor: '#f43f5e',
      secondaryColor: '#f59e0b',
      voidColor: '#0e0708',
      surfaceColor: '#180d0f',
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)',
      icon: 'local_fire_department',
      tags: ['Rock', 'Flamboyant', 'Ambre'],
    },
    {
      id: 'sapphire',
      name: 'Sapphire Abyss',
      subtitle: 'Abysses océaniques & Glace',
      description:
        'Immersion dans les profondeurs sous-marines avec un bleu saphir profond et un cyan arctique.',
      primaryColor: '#3b82f6',
      secondaryColor: '#06b6d4',
      voidColor: '#050a14',
      surfaceColor: '#0a1324',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
      icon: 'water_drop',
      tags: ['Océan', 'Profondeur', 'Cyan'],
    },
    {
      id: 'amethyst',
      name: 'Amethyst Twilight',
      subtitle: 'Crépuscule royal & Or',
      description:
        'Atmosphère royale et mystique combinant pourpre améthyste velouté et éclats d’or vénitien.',
      primaryColor: '#a855f7',
      secondaryColor: '#eab308',
      voidColor: '#0b0714',
      surfaceColor: '#140d24',
      gradient: 'linear-gradient(135deg, #a855f7 0%, #eab308 100%)',
      icon: 'diamond',
      tags: ['Royal', 'Mystique', 'Doré'],
    },
    {
      id: 'monochrome',
      name: 'Titanium Obsidian',
      subtitle: 'Minimalisme épuré & Argent',
      description:
        'Esthétique studio professionnelle haute fidélité en noir carbone, titane et nuances d’argent.',
      primaryColor: '#9494a8',
      secondaryColor: '#b5bdd4',
      voidColor: '#0a0a0c',
      surfaceColor: '#121215',
      gradient: 'linear-gradient(135deg, #cfcfe0 0%, #7a8299 100%)',
      icon: 'contrast',
      tags: ['Studio', 'Titane', 'Monochrome'],
    },
  ];

  readonly currentThemeId = signal<ThemeId>('from-zero');
  readonly currentTheme = computed<ColorTheme>(
    () => this.themes.find((t) => t.id === this.currentThemeId()) ?? this.themes[0]
  );

  readonly defaultTrackVisibility = signal<'public' | 'private'>('public');
  readonly autoPlayNext = signal<boolean>(true);
  readonly defaultVolume = signal<number>(0.8);
  readonly enableKeyboardShortcuts = signal<boolean>(true);

  constructor() {
    this.loadFromStorage();

    // Applique le thème au DOM dès que currentThemeId change
    effect(() => {
      const themeId = this.currentThemeId();
      this.applyThemeToDOM(themeId);
      this.saveToStorage();
    });
  }

  setTheme(themeId: ThemeId): void {
    if (this.currentThemeId() === themeId) return;

    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition === 'function'
    ) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        this.currentThemeId.set(themeId);
      });
    } else {
      this.currentThemeId.set(themeId);
    }
  }

  setDefaultTrackVisibility(visibility: 'public' | 'private'): void {
    this.defaultTrackVisibility.set(visibility);
    this.saveToStorage();
  }

  setAutoPlayNext(enabled: boolean): void {
    this.autoPlayNext.set(enabled);
    this.saveToStorage();
  }

  setDefaultVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.defaultVolume.set(clamped);
    this.saveToStorage();
  }

  setEnableKeyboardShortcuts(enabled: boolean): void {
    this.enableKeyboardShortcuts.set(enabled);
    this.saveToStorage();
  }

  resetToDefaults(): void {
    this.setTheme('from-zero');
    this.setDefaultTrackVisibility('public');
    this.setAutoPlayNext(true);
    this.setDefaultVolume(0.8);
    this.setEnableKeyboardShortcuts(true);
  }

  private applyThemeToDOM(themeId: ThemeId): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const data: Partial<AppPreferences> = JSON.parse(raw);
        if (data.theme && this.themes.some((t) => t.id === data.theme)) {
          this.currentThemeId.set(data.theme);
        }
        if (data.defaultTrackVisibility === 'public' || data.defaultTrackVisibility === 'private') {
          this.defaultTrackVisibility.set(data.defaultTrackVisibility);
        }
        if (typeof data.autoPlayNext === 'boolean') {
          this.autoPlayNext.set(data.autoPlayNext);
        }
        if (typeof data.defaultVolume === 'number') {
          this.defaultVolume.set(data.defaultVolume);
        }
        if (typeof data.enableKeyboardShortcuts === 'boolean') {
          this.enableKeyboardShortcuts.set(data.enableKeyboardShortcuts);
        }
      }
    } catch {
      // Ignorer si parsing invalide
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const prefs: AppPreferences = {
        theme: this.currentThemeId(),
        defaultTrackVisibility: this.defaultTrackVisibility(),
        autoPlayNext: this.autoPlayNext(),
        defaultVolume: this.defaultVolume(),
        enableKeyboardShortcuts: this.enableKeyboardShortcuts(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignorer si localStorage plein ou non accessible
    }
  }
}
