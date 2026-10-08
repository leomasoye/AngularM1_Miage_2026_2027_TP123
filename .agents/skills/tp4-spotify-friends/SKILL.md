---
name: tp4-spotify-friends
description: >
  Feuille de route complete du TP4 : features Spotify-like centrees sur la
  gestion des amis, likes de pistes, et player audio. Sert de reference
  pour planifier et implementer chaque feature dans les bonnes pratiques.
---

# TP4 Feuille de Route - Spotify Friends App

## Vision generale
Application musicale sociale style Spotify, conforme au sujet TP4 officiel.
3 axes : (1) Fichiers publics/prives + partage amis, (2) WebAudio API avancee,
(3) Social (amis, activite, likes)

---

## PRIORITE 1 - Fichiers publics/prives & Social

### A. Visibilite des pistes
- Backend : champ visibility ("public"|"private") sur Track
- GET /api/tracks/public : toutes pistes publiques
- GET /api/tracks/recent : recemment ajoutees (20 max)
- PATCH /api/tracks/:id/visibility : changer visibilite
- Frontend : VisibilityToggleComponent, section "Recemment ajoutes" sur Home

### B. Systeme d amis
- Modele Friendship (pending/accepted/rejected)
- Index compose unique requesterId+addresseeId
- CRUD : POST request, PATCH accept/reject, GET list, GET pending, DELETE
- Frontend : FriendsService signals, FriendsPage, FriendCard, badge pending

### C. Partage de pistes privees
- Nouveau modele Share : trackId, ownerId, sharedWithId
- POST /api/tracks/:id/share/:userId
- DELETE /api/tracks/:id/share/:userId (STOPPER le partage)
- GET /api/tracks/shared (pistes partagees avec moi)
- Frontend : ShareModalComponent, liste des amis, gestion arret partage

### D. Search Files (obligatoire sujet)
- GET /api/search?q=&type=tracks|users|all
- Debounce 300ms cote frontend
- Resultats groupes : pistes / utilisateurs
- Pistes publiques + pistes de l utilisateur + pistes partagees avec lui

### E. Likes
- likes: [ObjectId] sur Track, addToSet / pull
- toPublic() expose likesCount et liked (boolean selon user)
- Optimistic update cote frontend

### F. Activite des amis
- GET /api/friends/activity : pistes publiques + partagees des amis
- Frontend : ActivityFeedComponent avec flux chronologique

---

## PRIORITE 2 - WebAudio API (explicitement demande sujet)

### G. PlayerService avec Web Audio API
```typescript
private audioCtx = new AudioContext();
private analyserNode = this.audioCtx.createAnalyser();
private gainNode = this.audioCtx.createGain();
private stereoPannerNode = this.audioCtx.createStereoPanner();
// Signals : currentTrack, isPlaying, progress, volume, balance
```

### H. Waveform
- OfflineAudioContext pour decoder et dessiner la forme onde complete
- Canvas HTML5, gradient orchid/blue
- Curseur de position cliquable

### I. Visualiseur frequences temps reel
- AnalyserNode + requestAnimationFrame + Canvas
- Barres FFT animees, couleurs orchid/blue
- Background du player qui pulse selon la musique

### J. VU-metres Stereo
- getByteTimeDomainData en boucle sur G et D
- Deux barres verticales avec peak indicator
- Vert a orchid a rouge selon intensite

### K. Egalizer graphique
- Chaine BiquadFilterNode (Bass 100Hz, Mid 1kHz, Treble 8kHz)
- Sliders verticaux custom en dB
- Presets : Flat / Bass Boost / Vocal / Electronic

### L. Effets audio
- Reverb : ConvolverNode + impulse response synthetique
- Delay : DelayNode (time + feedback)
- Distortion : WaveShaperNode (amount)
- Filter : BiquadFilterNode (cutoff + resonance)
- Widgets : Knob rotatif Canvas/SVG, switches CSS, sliders custom

### M. Background visual (shaders)
- Canvas WebGL type Butterchurn/Milkdrop (opacite 0.4 en fond)
- Alternative : particules CSS orchid/blue synchronisees sur AnalyserNode

---

## PRIORITE 3 - Polish UX

### N. Avatar utilisateur
- PUT /api/users/me/avatar (multer, 5Mo, jpeg/png/webp)
- avatarUrl dans le modele User
- AvatarComponent avec border gradient orchid-blue

### O. Queue de lecture
- QueueService : queue, currentIndex, shuffle, repeat (signals)
- "Add to queue" sur chaque piste

### P. Notifications polling 30s
- Badge rouge sidebar si demandes d amis en attente
- Toast acceptation demande

---

## Tests unitaires (obligatoires sujet)

Backend (Jest/Mocha) :
- Friendship model : creation, index unique, toPublic
- Share model : creation, contraintes
- Routes friends : request, accept, reject
- Routes tracks : public/recent, like toggle, share/unshare

Frontend (Jasmine/Karma ou Jest) :
- FriendsService : signals, loading, error
- LikeButtonComponent : optimistic update
- PlayerService : play/pause, volume, balance, WebAudio nodes
- SearchService : debounce, resultats groupes

---

## REPORT.md (obligatoire sujet)
A rediger a la fin :
- Fonctionnalites implementees
- Choix techniques (WebAudio, MongoDB schema, Angular signals)
- Architecture (diagrammes, flux)
- Resultats des tests (couverture)
- Difficultes et solutions

---

## Modeles TypeScript a creer/etendre

```typescript
// track.model.ts (etendu)
export interface Track {
  id: string; ownerId: string; owner?: User;
  title: string; originalName: string; mimeType: string; size: number;
  visibility: 'public' | 'private'; // NOUVEAU
  likesCount: number; liked: boolean; // NOUVEAU
  createdAt: string;
}

// friendship.model.ts (NOUVEAU)
export interface Friendship {
  id: string; requesterId: string; addresseeId: string;
  status: 'pending' | 'accepted' | 'rejected';
  requester?: User; addressee?: User; createdAt: string;
}

// share.model.ts (NOUVEAU)
export interface Share {
  id: string; trackId: string; ownerId: string; sharedWithId: string;
  track?: Track; sharedWith?: User; createdAt: string;
}

// player-state.model.ts (NOUVEAU)
export interface PlayerState {
  currentTrack: Track | null; isPlaying: boolean;
  progress: number; volume: number; balance: number; // -1 a 1
  isShuffle: boolean; repeatMode: 'none' | 'one' | 'all';
}
```

---

## Ordre d implementation recommande
1. Refonte UI globale (styles.scss, layout, Outfit)
2. Visibilite public/prive + section "Recemment ajoutes"
3. Search Files (barre + API)
4. Systeme d amis (Friendship + FriendsPage)
5. Partage de pistes (Share + modal + stopper)
6. Activite des amis (ActivityFeed)
7. Likes (LikeButton optimistic)
8. Player WebAudio de base (AudioContext + PlayerBar)
9. Waveform (Canvas + OfflineAudioContext)
10. VU-metres + Visualiseur frequences (AnalyserNode + Canvas)
11. Egaliseur + Effets audio (filtres WebAudio + knobs)
12. Background shaders (WebGL / CSS)
13. Avatar, Queue, Notifications (polish)
14. Tests unitaires (toutes features)
15. REPORT.md
