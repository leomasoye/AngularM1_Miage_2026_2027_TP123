import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../shared/services/theme.service';
import { GlowService } from '../../shared/services/glow.service';
import { PlayerService } from '../../shared/services/player.service';
import { ThemeId } from '../../shared/models/theme.model';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  readonly themeService = inject(ThemeService);
  readonly glow = inject(GlowService);
  readonly player = inject(PlayerService);

  readonly resetNotice = signal<string | null>(null);

  selectTheme(themeId: ThemeId): void {
    this.themeService.setTheme(themeId);
  }

  toggleGlow(): void {
    this.glow.toggleGlow();
  }

  onIntensityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    this.glow.setIntensity(value);
  }

  toggleParticles(): void {
    this.glow.toggleParticles();
  }

  onDefaultVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value) / 100;
    this.themeService.setDefaultVolume(value);
    this.player.setVolume(value);
  }

  toggleAutoPlayNext(): void {
    this.themeService.setAutoPlayNext(!this.themeService.autoPlayNext());
  }

  setDefaultVisibility(v: 'public' | 'private'): void {
    this.themeService.setDefaultTrackVisibility(v);
  }

  toggleKeyboardShortcuts(): void {
    this.themeService.setEnableKeyboardShortcuts(
      !this.themeService.enableKeyboardShortcuts()
    );
  }

  resetAll(): void {
    if (confirm('Voulez-vous vraiment réinitialiser tous les paramètres aux valeurs d’origine ?')) {
      this.themeService.resetToDefaults();
      this.glow.setGlowEnabled(true);
      this.glow.setIntensity(1.0);
      if (!this.glow.particlesEnabled()) {
        this.glow.toggleParticles();
      }
      this.player.setVolume(0.8);
      this.resetNotice.set('Tous les paramètres ont été réinitialisés avec succès.');
      setTimeout(() => this.resetNotice.set(null), 3500);
    }
  }
}
