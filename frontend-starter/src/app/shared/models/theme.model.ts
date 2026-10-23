export type ThemeId =
  | 'from-zero'
  | 'cyberpunk'
  | 'emerald'
  | 'sunset'
  | 'sapphire'
  | 'amethyst'
  | 'monochrome';

export interface ColorTheme {
  id: ThemeId;
  name: string;
  subtitle: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  voidColor: string;
  surfaceColor: string;
  gradient: string;
  icon: string;
  tags: string[];
}

export interface AppPreferences {
  theme: ThemeId;
  defaultTrackVisibility: 'public' | 'private';
  autoPlayNext: boolean;
  defaultVolume: number; // 0 to 1
  enableKeyboardShortcuts: boolean;
}
