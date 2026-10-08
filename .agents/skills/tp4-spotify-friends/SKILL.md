---
name: tp4-spotify-friends
description: >
  Feuille de route complete du TP4 : features Spotify-like centrees sur la
  gestion des amis, likes de pistes, et player audio. Sert de reference
  pour planifier et implementer chaque feature dans les bonnes pratiques.
---

# TP4 Feuille de Route - Spotify Friends App

## Vision generale
Application musicale style Spotify centree sur le social :
- Ecouter et partager sa musique avec ses amis
- Liker les pistes des autres
- Voir l activite de ses amis en temps reel
- UI inspiree de l album "From Zero" de Linkin Park

---

## Nouvelles features par priorite

### PRIORITE 1 - Core social (backend + frontend)

#### Feature A : Systeme d amis
- **Backend** : Modele Friendship (pending/accepted/rejected)
- **API** : POST /friends/request/:userId, PATCH /friends/request/:id, GET /friends, DELETE /friends/:userId
- **Frontend** : Page "Discover" pour chercher des utilisateurs, composant FriendRequest
- **Service Angular** : FriendsService avec signals

#### Feature B : Likes sur les pistes
- **Backend** : Champ likes: [ObjectId] sur Track, POST/DELETE /tracks/:id/like
- **API** : Exposer likesCount et liked (boolean) dans toPublic()
- **Frontend** : Bouton like avec animation, compteur de likes
- **Service Angular** : LikesService

#### Feature C : Voir les pistes des amis
- **Backend** : GET /api/tracks/friends (toutes les pistes des amis acceptes)
- **Frontend** : Onglet "Friends" dans la page tracks

### PRIORITE 2 - Experience musicale

#### Feature D : Lecteur audio persistent
- **Frontend** : PlayerBarComponent fixe en bas de page
- **Service** : PlayerService avec signal track courante, play/pause, progression
- **Pattern** : Singleton service, AudioContext Web API

#### Feature E : File de lecture (Queue)
- **Service** : QueueService avec signal liste, index courant, shuffle, repeat
- **Frontend** : Bouton "Add to queue", composant QueuePanel

#### Feature F : Avatar utilisateur
- **Backend** : PUT /api/users/me/avatar (upload image, multer)
- **Frontend** : Composant AvatarUpload

### PRIORITE 3 - Polish UX

#### Feature G : Notifications en temps reel (optionnel)
- **Backend** : SSE (Server-Sent Events) ou polling toutes les 30s
- **Frontend** : NotificationService, badge sur l icone amis

#### Feature H : Recherche globale
- **Backend** : GET /api/search?q= (pistes + utilisateurs)
- **Frontend** : SearchBarComponent dans la navbar avec debounce

---

## Architecture frontend cible

```
src/app/
+-- components/
|   +-- app/                  # Root component + layout
|   +-- navbar/               # Sidebar navigation
|   +-- player-bar/           # Lecteur fixe bas de page (NOUVEAU)
|   +-- login-page/
|   +-- register-page/
|   +-- tracks-page/          # Mes pistes (ameliore)
|   |   +-- track-upload/
|   |   +-- track-row/        # Composant ligne piste (NOUVEAU)
|   +-- friends-page/         # NOUVEAU
|   |   +-- friend-card/
|   |   +-- friend-request/
|   +-- discover-page/        # NOUVEAU - Chercher des users
|   +-- profile-page/         # Ameliore avec avatar
+-- shared/
    +-- models/
    |   +-- user.model.ts
    |   +-- track.model.ts    # Ajouter likesCount, liked
    |   +-- friendship.model.ts  # NOUVEAU
    |   +-- player-state.model.ts # NOUVEAU
    +-- services/
    |   +-- auth.service.ts
    |   +-- tracks.service.ts  # Ameliore
    |   +-- friends.service.ts # NOUVEAU
    |   +-- player.service.ts  # NOUVEAU
    |   +-- queue.service.ts   # NOUVEAU
    |   +-- search.service.ts  # NOUVEAU
    +-- guards/ + interceptors/
    +-- pipes/
        +-- duration.pipe.ts   # NOUVEAU - formater la duree
        +-- file-size.pipe.ts  # Existant ou NOUVEAU
```

---

## Modeles TypeScript a creer

```typescript
// friendship.model.ts
export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted' | 'rejected';
  requester?: User; // populated
  addressee?: User; // populated
  createdAt: string;
}

// player-state.model.ts
export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number; // 0-100
  volume: number;   // 0-1
  isShuffle: boolean;
  repeatMode: 'none' | 'one' | 'all';
}

// track.model.ts (etendu)
export interface Track {
  id: string;
  ownerId: string;
  owner?: User;     // populated depuis GET /friends tracks
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  likesCount: number;  // NOUVEAU
  liked: boolean;      // NOUVEAU - si l utilisateur courant a like
  createdAt: string;
}
```

---

## Patterns de composants cles

### Track Row (ligne dans la liste)
Inputs : track, index, isPlaying
Outputs : onPlay, onLike, onDelete

### Friend Card
Inputs : user, friendship?
Outputs : onSendRequest, onAccept, onDecline, onRemove

### Player Bar
Utilise PlayerService directement (inject)
Pas d Input/Output, etat global via signal

---

## Checklist qualite par feature
- Service injectable avec signals (loading, error, data)
- Lazy loading de la page
- Guard si route protegee
- Composants avec OnPush
- trackBy dans tous les @for
- Gestion d erreur user-friendly
- Animations CSS From Zero
- Responsive (sidebar collapse sur mobile)
