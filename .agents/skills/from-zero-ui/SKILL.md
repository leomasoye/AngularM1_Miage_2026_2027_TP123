---
name: from-zero-ui
description: >
  Design system inspire de l'album "From Zero" de Linkin Park (2024).
  Palette orchid/bleu electrique sur fond charbon, textures marbre fluide,
  typographie Outfit, micro-animations CSS. A utiliser pour tout composant
  UI du TP4.
---

# From Zero UI Design System

## Philosophie
Inspire de l'artwork de "From Zero" : fluid organique, marbre, kintsugi.
- Fond sombre charbon comme toile neutre
- Explosions de couleur orchid/purple et bleu electrique comme accents
- Textures fluides et layering avec glassmorphism subtil
- Typographie Outfit (Google Fonts) pour modernite

## Palette de couleurs (variables CSS globales)

`scss
:root {
  // Backgrounds
  --bg-void: #0d0d0f;          // Fond principal ultra-sombre
  --bg-surface: #13131a;       // Cards, surfaces
  --bg-elevated: #1a1a26;      // Elements sureleves
  --bg-overlay: #22223a;       // Hover states, overlays

  // Orchid - couleur primaire
  --orchid-900: #2d0a3d;
  --orchid-700: #6b1fa8;
  --orchid-500: #9b3fd4;       // Accent principal
  --orchid-300: #c47aed;
  --orchid-100: #e8c4f8;

  // Electric Blue - couleur secondaire
  --blue-900: #020b1a;
  --blue-700: #0a4080;
  --blue-500: #1a7fe8;         // Accent secondaire
  --blue-300: #5aaaf5;
  --blue-100: #c0deff;

  // Text
  --text-primary: #f0f0f5;
  --text-secondary: #9999b3;
  --text-muted: #55556b;

  // Gradients signature
  --gradient-orchid-blue: linear-gradient(135deg, #9b3fd4 0%, #1a7fe8 100%);
  --gradient-marble: linear-gradient(
    135deg,
    #6b1fa8 0%,
    #9b3fd4 25%,
    #1a7fe8 50%,
    #0a4080 75%,
    #6b1fa8 100%
  );
  --gradient-void: linear-gradient(180deg, #13131a 0%, #0d0d0f 100%);

  // Glassmorphism
  --glass-bg: rgba(26, 26, 38, 0.7);
  --glass-border: rgba(155, 63, 212, 0.2);
  --glass-blur: blur(20px);

  // Shadows
  --shadow-orchid: 0 0 30px rgba(155, 63, 212, 0.3);
  --shadow-blue: 0 0 30px rgba(26, 127, 232, 0.3);
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.6);

  // Borders
  --border-subtle: 1px solid rgba(155, 63, 212, 0.15);
  --border-accent: 1px solid rgba(155, 63, 212, 0.5);

  // Border radius
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;

  // Transitions
  --transition-fast: 150ms ease;
  --transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 600ms cubic-bezier(0.4, 0, 0.2, 1);
}
`

## Typographie

`html
<!-- Dans index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
`

`scss
body {
  font-family: 'Outfit', sans-serif;
  background: var(--bg-void);
  color: var(--text-primary);
}

// Scale typographique
.text-hero    { font-size: 3.5rem; font-weight: 800; line-height: 1.1; }
.text-display { font-size: 2.5rem; font-weight: 700; line-height: 1.2; }
.text-heading { font-size: 1.5rem; font-weight: 600; line-height: 1.3; }
.text-body    { font-size: 1rem;   font-weight: 400; line-height: 1.6; }
.text-small   { font-size: 0.875rem; font-weight: 400; }
.text-label   { font-size: 0.75rem;  font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
`

## Composants UI cles

### Glass Card
`scss
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-orchid), var(--shadow-card);
    border-color: rgba(155, 63, 212, 0.4);
  }
}
`

### Bouton primaire (gradient orchid-blue)
`scss
.btn-primary {
  background: var(--gradient-orchid-blue);
  color: white;
  border: none;
  border-radius: var(--radius-pill);
  padding: 0.75rem 2rem;
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: opacity var(--transition-fast), transform var(--transition-fast);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.1);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  &:hover::after { opacity: 1; }
  &:hover { transform: scale(1.02); }
  &:active { transform: scale(0.98); }
}
`

### Like button avec animation
`scss
.btn-like {
  background: transparent;
  border: var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--text-secondary);
  transition: all var(--transition-normal);

  .heart-icon {
    transition: transform var(--transition-fast);
  }

  &.liked {
    background: rgba(155, 63, 212, 0.15);
    border-color: var(--orchid-500);
    color: var(--orchid-300);
  }

  &:hover .heart-icon { transform: scale(1.2); }
  &.liked .heart-icon { transform: scale(1.15); }
}
`

### Track row (style Spotify)
`scss
.track-row {
  display: grid;
  grid-template-columns: 2rem 1fr auto auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-elevated);
  }

  &.playing {
    .track-index { color: var(--orchid-500); }
  }
}
`

### Sidebar de navigation
`scss
.sidebar {
  width: 240px;
  background: var(--bg-surface);
  border-right: var(--border-subtle);
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.5rem 1rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: all var(--transition-fast);

  &.active, &:hover {
    background: rgba(155, 63, 212, 0.1);
    color: var(--text-primary);
  }
  &.active {
    color: var(--orchid-300);
    border-left: 2px solid var(--orchid-500);
  }
}
`

### Lecteur audio bas de page
`scss
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border-top: var(--border-subtle);
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  padding: 0 2rem;
  z-index: 100;
}
`

## Animations CSS

### Entree des cartes
`scss
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeInUp 0.4s var(--transition-normal) both;
}

// Stagger pour les listes
@for  from 1 through 20 {
  :nth-child(#{}) { animation-delay: #{ * 50}ms; }
}
`

### Pulse orchid pour la piste en cours
`scss
@keyframes orchidPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(155, 63, 212, 0.4); }
  50%       { box-shadow: 0 0 0 8px rgba(155, 63, 212, 0); }
}

.now-playing {
  animation: orchidPulse 2s ease infinite;
}
`

### Barres equalizer animees
`scss
.equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
}

.eq-bar {
  width: 3px;
  background: var(--gradient-orchid-blue);
  border-radius: 2px;
  animation: eqBar 0.8s ease infinite alternate;

  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}

@keyframes eqBar {
  from { height: 4px; }
  to   { height: 100%; }
}
`

## Avatar utilisateur
`scss
.avatar {
  border-radius: 50%;
  border: 2px solid transparent;
  background-origin: border-box;
  background-clip: content-box, border-box;
  background-image: none, var(--gradient-orchid-blue);
  // cree un border gradient autour de l'avatar
}
`

## Regles de design
1. Jamais de blanc pur (#fff) - utiliser --text-primary (#f0f0f5)
2. Jamais de noir pur - utiliser --bg-void (#0d0d0f)
3. Gradients uniquement sur les CTAs et elements mis en valeur
4. Textures marbre en background overlay <0.3 opacity
5. Toutes les transitions en cubic-bezier, jamais en linear
6. Min contrast ratio 4.5:1 pour le texte (WCAG AA)
