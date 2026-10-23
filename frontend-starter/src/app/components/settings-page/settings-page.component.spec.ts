import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsPageComponent } from './settings-page.component';
import { ThemeService } from '../../shared/services/theme.service';
import { GlowService } from '../../shared/services/glow.service';
import { PlayerService } from '../../shared/services/player.service';

describe('SettingsPageComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;
  let themeService: ThemeService;
  let glowService: GlowService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [ThemeService, GlowService, PlayerService],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    glowService = TestBed.inject(GlowService);
    fixture.detectChanges();
  });

  it('devrait être instancié avec succès', () => {
    expect(component).toBeTruthy();
  });

  it('devrait afficher la liste des thèmes disponibles', () => {
    expect(component.themeService.themes.length).toBeGreaterThanOrEqual(7);
  });

  it('devrait changer le thème sélectionné lorsqu on appelle selectTheme', () => {
    component.selectTheme('sunset');
    expect(themeService.currentThemeId()).toBe('sunset');
  });

  it('devrait basculer l ambiance lumineuse audio-réactive', () => {
    const initialGlow = glowService.isEnabled();
    component.toggleGlow();
    expect(glowService.isEnabled()).toBe(!initialGlow);
  });

  it('devrait basculer l enchaînement automatique (auto-play)', () => {
    const initialAutoPlay = themeService.autoPlayNext();
    component.toggleAutoPlayNext();
    expect(themeService.autoPlayNext()).toBe(!initialAutoPlay);
  });

  it('devrait modifier la visibilité par défaut des morceaux', () => {
    component.setDefaultVisibility('private');
    expect(themeService.defaultTrackVisibility()).toBe('private');
    component.setDefaultVisibility('public');
    expect(themeService.defaultTrackVisibility()).toBe('public');
  });
});
