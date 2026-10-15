import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlowService {
  private readonly STORAGE_KEY = 'from_zero_reactive_glow';

  readonly isEnabled = signal<boolean>(true);
  readonly intensity = signal<number>(1.0); // Facteur d'intensité (0.5 à 1.5)
  readonly particlesEnabled = signal<boolean>(true);

  constructor() {
    this.loadFromStorage();
  }

  toggleGlow(): void {
    const nextState = !this.isEnabled();
    this.isEnabled.set(nextState);
    this.saveToStorage();
  }

  setGlowEnabled(enabled: boolean): void {
    this.isEnabled.set(enabled);
    this.saveToStorage();
  }

  setIntensity(val: number): void {
    const clamped = Math.max(0.2, Math.min(2.0, val));
    this.intensity.set(clamped);
    this.saveToStorage();
  }

  toggleParticles(): void {
    const next = !this.particlesEnabled();
    this.particlesEnabled.set(next);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (typeof data.isEnabled === 'boolean') {
          this.isEnabled.set(data.isEnabled);
        }
        if (typeof data.intensity === 'number') {
          this.intensity.set(data.intensity);
        }
        if (typeof data.particlesEnabled === 'boolean') {
          this.particlesEnabled.set(data.particlesEnabled);
        }
      }
    } catch {
      // Ignorer si parsing invalide
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          isEnabled: this.isEnabled(),
          intensity: this.intensity(),
          particlesEnabled: this.particlesEnabled(),
        })
      );
    } catch {
      // Ignorer si localStorage plein ou non accessible
    }
  }
}
