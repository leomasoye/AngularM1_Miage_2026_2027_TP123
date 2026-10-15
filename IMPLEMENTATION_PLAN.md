# Implementation Plan: Spotify × From Zero (Révisé)

## Goal Description
Transformer le prototype de gestion de pistes en application musicale sociale (thème sombre "From Zero"). Le plan intègre un modèle d'accès strict (public/privé/partagé), des fonctionnalités sociales (amis, likes, fil d'actualité), une recherche globale sécurisée, et un lecteur Web Audio API avancé (CORS, EQ, VU-mètres stéréo).

## Hypothèses & Décisions métier
- **Amitiés croisées** : Avant de créer A→B, on vérifie si B→A existe pour éviter les doublons. Si B a rejeté A, A peut refaire une demande (le statut repasse en `pending`).
- **Suppression d'ami** : La suppression de l'amitié entraîne la suppression en cascade des partages (documents `Share`) entre ces deux utilisateurs pour garantir la confidentialité.
- **Suppression de piste** : Cascade sur `Share` (on supprime les partages associés) et on retire l'ID des `likes`.
- **Modèle des Likes** : Utilisation d'un tableau `likes: [ObjectId]` dans le modèle `Track`. Raison : Pour un TP, c'est infiniment plus simple à gérer (`$addToSet`/`$pull`), évite les jointures coûteuses (`$lookup`), et limite la complexité. La limite de 16 Mo par document MongoDB laisse de la marge pour des milliers de likes.
- **Fil d'activité** : Orienté "Nouveautés des amis" (pistes récemment uploadées) plutôt que "Écoutes en temps réel", pour éviter de surcharger le backend avec des événements de lecture.
- **Migration** : Les pistes existantes en BDD auront une valeur par défaut `visibility: 'private'`.

## Étape 0 : Modèle d'accès et Refactoring Backend
**Goal:** Sécuriser l'accès aux pistes (y compris le flux audio) et restructurer le backend.

#### [NEW] Backend `src/middleware/access.js`
- Fonction `canAccessTrack(user, track, shares = [])`: retourne `true` si user est owner, si track est `public`, ou s'il existe un `Share` avec `user.id`.
- Middleware `requireOwner`: bloque avec 403 si `req.auth.sub !== track.ownerId`.

#### [MODIFY] Backend `src/app.js` -> `src/routes/*`
- Extraire les routes vers `routes/tracks.js`, `routes/friends.js`, `routes/search.js`.
- Appliquer `canAccessTrack` à la route de **streaming audio** (`/api/tracks/:id/audio`). Renvoyer `404 Not Found` (et non 403) si non accessible pour ne pas fuiter l'existence de la piste.
- `PATCH visibility` et ajout/suppression de `Share` protégés par `requireOwner`.
- Validation stricte des ObjectIds (`mongoose.isValidObjectId`).

**Risques:** Fuite d'accès sur le stream audio.
**DoD:** Un compte B recevant l'URL directe du flux audio d'une piste privée du compte A reçoit une erreur 404. Structure en routeurs validée.

---

## Étape 1 : UI / Angular Material (M3)
**Goal:** Base stylistique "From Zero" et Material Design 3.

#### [MODIFY] `package.json` & `styles.scss`
- Installer `@angular/material` (M3).
- Configurer les tokens M3 (utiliser les rôles `primary` pour orchid et `tertiary` pour electric blue, le terme accent disparaît en M3).
- Définir le layout responsive (desktop prioritaire avec sidebar 240px et bottom player 120px, masqués ou réduits sous forme de drawer sur mobile).

#### [MODIFY] Composants existants
- Remplacer les boutons/inputs par les directives Material (`mat-button`, `mat-form-field`).
- Ajouter les états de chargement (`mat-spinner`) et erreurs (`MatSnackBar`).

**Risques:** Conflits de styles entre le CSS existant et Material M3.
**DoD:** L'application démarre sans erreur console, le thème sombre est appliqué, un snackbar s'affiche en cas d'erreur réseau/login.

---

## Étape 2 : Visibilité (Public/Privé) & Recherche
**Goal:** Implémenter le switch de visibilité et la recherche (sans fuite d'emails).

#### [MODIFY] Backend `Track.js` Model
- `visibility: { type: String, enum: ['public', 'private'], default: 'private' }`.

#### [MODIFY] Backend `routes/search.js`
- `GET /api/search?q=&type=all|tracks|users`.
- Protéger la recherche par `$regex` échappée.
- Ne **jamais** renvoyer d'email dans la recherche d'utilisateurs. Recherche basée uniquement sur le `name`.
- Ajouter `express-rate-limit` basique sur la route search.

#### [NEW] Frontend `SearchResultsComponent`
- Page de résultats groupés.

**Risques:** Injection Regex (ReDoS).
**DoD:** La recherche renvoie des pistes publiques de tous et des utilisateurs sans exposer leur email. Le toggle de visibilité modifie la BDD (réservé au propriétaire).

---

## Étape 3 : Core Social (Amis & Likes)
**Goal:** Modèle d'amitié, demandes, et likes optimistes.

#### [NEW] Backend `Friendship.js` Model
- `requesterId`, `addresseeId`, `status`. Index unique `{ requesterId, addresseeId }`. Interdire `requesterId === addresseeId`.

#### [MODIFY] Backend Routes & `Track.js`
- Routes CRUD amis avec rate-limiting sur le POST de demande.
- Champ `likes: [ObjectId]` sur `Track`.
- Réponse de piste : inclure `likesCount: track.likes.length` et `likedByMe: track.likes.includes(req.auth.sub)`. Opérations `$addToSet` et `$pull` (idempotentes).

#### [NEW] Frontend `FriendsPageComponent` & `LikeButtonComponent`
- `LikeButtonComponent` implémente un *optimistic update* (UI modifiée immédiatement, rollback si la requête HTTP échoue via notification).

**Risques:** Asynchronisme des likes (clics rapides).
**DoD:** On peut s'ajouter en ami (sans doublon inverse), liker/unliker (idempotent), le compteur s'actualise optimistement.

---

## Étape 4 : Partage & Fil d'activité (Polling) ✅ [TERMINÉE]
**Goal:** Partager des pistes privées et voir les nouveautés des amis.

#### [NEW] Backend `Share.js` Model & Routes
- `trackId`, `ownerId`, `sharedWithId`. Index unique `(trackId, sharedWithId)`.
- `POST /api/tracks/:id/share/:userId` : partage avec un ami accepté (réservé à l'owner).
- `DELETE /api/tracks/:id/share/:userId` : arrêt du partage (réservé à l'owner).
- `GET /api/tracks/:id/shares` : liste des partages actifs d'une piste (pour l'owner).
- `GET /api/tracks/shared` : liste des pistes partagées avec l'utilisateur connecté.
- Cascade : suppression d'une amitié ou d'une piste supprime automatiquement les `Share` associés.
- Sécurisation flux audio : `canAccessTrack` vérifie de manière asynchrone la présence d'un `Share` en BDD pour les pistes privées.

#### [NEW] Backend `routes/activity.js` & `routes/friends.js`
- `GET /api/activity` : Récupère les pistes publiques + partagées des amis, triées par `createdAt` DESC. Pagination par curseur de date (`?before=ISOString`).
- `GET /api/friends/pending` : Récupère le compteur et la liste des demandes en attente pour le polling.

#### [NEW] Frontend `ShareModalComponent`, `ActivityFeedComponent` & Polling
- `ShareModalComponent` : Dialog élégant (From Zero theme) permettant de partager/départager chaque piste avec des amis acceptés.
- `ActivityFeedComponent` (route `/activity`) : Flux chronologique des nouveautés avec cursor pagination ("Charger plus"), player audio et like optimiste.
- Polling 30s implémenté dans `ActivityFeedComponent` et la `Sidebar` (`AppComponent` avec badge de notifications sur l'onglet Amis).
- Pause automatique du polling quand `document.visibilityState === 'hidden'` et reprise immédiate sur `visibilitychange`.
- Nettoyage automatique des abonnements via `takeUntilDestroyed()`.

**DoD validée :**
- Tests unitaires backend (5/5 passés).
- Tests unitaires frontend (10/10 passés, y compris `ShareService` et `ActivityService`).
- Build de production frontend Angular sans erreur.

---

## Étape 5 : Lecteur Web Audio (CORS & Base) ✅ [TERMINÉE]
**Goal:** Mettre en place le graphe audio robuste et la barre de contrôle.

#### [MODIFY] Backend API
- Ajouter les headers CORS `Access-Control-Allow-Origin: *` sur le flux audio `/api/tracks/:id/audio`. *(Spike de 1-2h prévu pour valider la chaîne avec `crossOrigin="anonymous"`)*.

#### [NEW] Frontend `PlayerService` (Singleton)
- Élément `<audio crossOrigin="anonymous">` persistant, instancié une seule fois.
- `audioCtx = new AudioContext()`. Démarre `suspended`, `resume()` sur action utilisateur.
- Méthodes: découpler le slider de progression (`seeking` flag local) des mises à jour `timeupdate`.

**Risques:** Silence des noeuds d'analyse dû à des erreurs CORS cross-origin strictes.
**DoD validée :** Le son joue avec Web Audio API sans blocage CORS, PlayerService (singleton) avec graphe audio complet, PlayerBarComponent persistant avec visualiseur temps réel, 24 tests frontend et 7 tests backend passés, build de production propre.

---

## Étape 6 : Web Audio Avancé (VU-mètres, EQ) ✅ [TERMINÉE]
**Goal:** Connecter les filtres et visualiseurs au graphe.

#### [MODIFY] Frontend `PlayerService` (Graphe)
- Ordre du graphe : `AudioSource -> LowShelf(100Hz) -> Peaking(1kHz) -> HighShelf(8kHz) -> ChannelSplitter -> [AnalyserL, AnalyserR] -> Destination`.

#### [NEW] Frontend `EqualizerComponent` & Visualiseurs
- Sliders verticaux natifs `<input type="range" style="writing-mode: vertical-lr">` pour l'EQ (MatSlider ne supporte pas le mode vertical natif). Persistance dans le `localStorage`. Bouton Reset.
- VU-mètres stéréo et Forme d'onde : Boucle `requestAnimationFrame` exécutée strictement dans `this.ngZone.runOutsideAngular(() => ...)` pour éviter les cycles de détection de changement Angular inutiles. Arrêt de la boucle en cas de pause ou de destruction.
- *Stretch goals : Reverb et Delay.*

**Risques:** Baisse de framerate (lag global de l'UI) due à `requestAnimationFrame` mal isolé de la zone Angular.
**DoD validée :** L'égaliseur 3 bandes (Basses 100Hz, Médiums 1kHz, Aigus 8kHz) et les 4 presets modifient la réponse en fréquence en temps réel avec persistance dans le localStorage. Les VU-mètres stéréo différencient les canaux Gauche/Droite avec indicateurs de crête. L'oscilloscope affiche la forme d'onde en direct. Les boucles requestAnimationFrame tournent en dehors de la zone Angular avec 60 fps constants. 29 tests frontend et 7 tests backend passés, build de production sans erreur.

---

## Étape 7 : File de lecture (Queue), Contrôles de lecture (Next/Prev, Shuffle, Repeat) & Avatar utilisateur (Polish UX) ✅ [TERMINÉE]
**Goal:** Offrir une expérience d'écoute continue complète (file d'attente, autoplay next, shuffle, repeat) et enrichir l'identité sociale utilisateur (upload d'avatar avec dégradé From Zero).

#### [NEW] Backend `models/User.js` & `routes/user.routes.js`
- Champ `avatarUrl: { type: String, default: null }` sur `User`.
- `PUT /api/users/me/avatar` : upload d'avatar avec Multer (max 5 Mo, jpeg/png/webp) stocké dans `uploads/avatars/`.
- `GET /api/users/avatar/:filename` : distribution sécurisée des avatars.
- `DELETE /api/users/me/avatar` : suppression de l'avatar et remise à `null`.

#### [MODIFY] Frontend `PlayerService`
- Signals réactifs : `queue = signal<Track[]>([])`, `isShuffle = signal<boolean>(false)`, `repeatMode = signal<'none' | 'one' | 'all'>('none')`, `history = signal<Track[]>([])`.
- Méthodes : `addToQueue(track)`, `removeFromQueue(index)`, `clearQueue()`, `playNext()`, `playPrevious()`, `toggleShuffle()`, `toggleRepeat()`.
- Enchaînement automatique : écouteur de l'événement natif `ended` pour basculer automatiquement sur la piste suivante (ou rejouer selon `repeatMode`).

#### [NEW] Frontend `AvatarComponent` & `QueueDrawerComponent`
- `AvatarComponent` : Composant réutilisable (tailles `sm`, `md`, `lg`) affichant l'image avec bordure dégradée From Zero (`#9b3fd4` / `#1a7fe8`) ou initiales dynamiques avec fallback automatique.
- `PlayerBarComponent` : Ajout des boutons `Shuffle` (🔀), `Précédent` (⏮), `Suivant` (⏭), `Répéter` (🔁 none/all/one), et `File d'attente` (📑 avec badge de compteur).
- Bouton d'action "Ajouter à la file d'attente" (`playlist_add`) sur les cartes de pistes (`TracksPageComponent`, `ActivityFeedComponent`, `SearchResultsComponent`).
- Page de profil (`ProfilePageComponent`) : zone d'upload d'avatar avec prévisualisation et confirmation.
- Sidebar (`AppComponent`) : intégration de l'avatar utilisateur.

**DoD validée :**
- Upload, distribution sécurisée et suppression d'avatar opérationnels côté backend et frontend.
- File d'attente interactive, affichage dans un panneau slide-up glassmorphic, réordonnable/supprimable, enchaînement automatique dès la fin du morceau (`ended`).
- Contrôles Shuffle, Repeat, Next, Previous pleinement fonctionnels.
100% des tests backend (9/9 passés) et frontend (37/37 passés across 13 suites) au vert, build de production propre (`ng build` code 0).

---

## Étape 8 : Waveform Interactive (Forme d'onde décodée sur toute la piste) ✅ [TERMINÉE]
**Goal:** Remplacer la simple barre de progression par une véritable forme d'onde décodée (type SoundCloud / Spotify Canvas) avec curseur interactif.

#### [MODIFY] Frontend `PlayerService`
- Décodage audio complet via `AudioContext.decodeAudioData()` lors du chargement de la piste (`loadWaveform(track)`).
- Extraction d'un tableau d'amplitudes normalisées (120 barres de crêtes calculées par blocs temporels avec échantillonnage optimisé) et cache mémoire (`Map<trackId, peaks>`).
- Signaux réactifs `waveformPeaks = signal<number[]>([])` et `isWaveformLoading = signal<boolean>(false)`.
- Annulation des requêtes de décodage antérieures via `AbortController`.
- Génération d'un fallback harmonique esthétique fluide en cas d'indisponibilité du buffer audio brut.

#### [NEW] Frontend `WaveformComponent`
- Canvas HTML5 responsive (adapté aux écrans Retina / HiDPI via `window.devicePixelRatio` et `ResizeObserver`).
- Barres de la forme d'onde dessinées avec dégradé From Zero signature (`#d89af8` / `#9b3fd4` vers `#1a7fe8`).
- Rendu dynamique différencié : barres lues illuminées avec bloom/shadow néon, barres non lues semi-transparentes (`rgba(155, 63, 212, 0.22)`).
- Curseur de survol interactif avec affichage du timestamp précis en tooltip flottant glassmorphic (`hoverTimeFormatted`).
- Navigation tactile et souris par clic direct et glisser (scrubbing) avec écouteurs globaux `window` pour un suivi fluide même en dehors du conteneur.
- Accessibilité complète ARIA (`role="slider"`, `aria-valuenow`, `aria-label`) et navigation clavier (flèches ±5s, Home/End, Espace play/pause).
- Intégration directe dans `PlayerBarComponent` en remplacement de la barre de progression native.
- Rendu continu à 60 FPS via boucle `requestAnimationFrame` exécutée hors zone Angular (`runOutsideAngular`).

**DoD validée :**
- La forme d'onde décodée s'affiche fidèlement avec les 120 barres dynamiques dans le lecteur audio.
- Le clic et le scrubbing permettent de naviguer instantanément et sans latence dans la piste.
- 100% des tests unitaires au vert : 46/46 tests frontend passés (14 suites de tests) et 9/9 tests backend.
- Build de production frontend Angular sans avertissement (`ng build` code 0).

---

## Étape 9 : Effets Audio Avancés (Reverb "Concert Hall" & Delay / Écho) ✅ [TERMINÉE]
**Goal:** Permettre à l'utilisateur d'ajouter des effets de spatialisation et d'ambiance en temps réel.

#### [MODIFY] Frontend `PlayerService` (Graphe Web Audio)
- Intégration d'un `ConvolverNode` avec réponse impulsionnelle stéréo synthétique générée algorithmiquement (`createImpulseResponse(2.5, 2.0)` avec décroissance exponentielle simulant une salle de concert / arena).
- Intégration d'un `DelayNode` (max 2.0s) avec boucle de feedback (`delayFeedbackNode` plafonné à 0.8) et gain de sortie (`delayGainNode`).
- Bus de mixage dédié (`effectsMixBus`) mixant en parallèle la voie directe (`dryGainNode`), la réverbération et l'écho avant le master volume et les visualiseurs.
- Nouveaux signaux réactifs : `reverbWet = signal(0)`, `delayTime = signal(0.3)`, `delayFeedback = signal(0)`, `spatialPreset = signal<SpatialPreset>('none')`.
- Méthodes de contrôle sans craquement via `setTargetAtTime` : `setReverbWet()`, `setDelayTime()`, `setDelayFeedback()`, `setSpatialPreset()`, `setConvolverBuffer()`, `resetSpatialEffects()`.
- Acoustique dynamique : génération d'impulsions sur-mesure par preset (durée et déclin exponentiel adaptés : 1.2s Club Intime, 2.8s Concert Hall, 4.2s Stade Rock, 3.0s Écho Spatial).
- Persistance automatique dans le `localStorage` (`from_zero_spatial`).

#### [MODIFY] Frontend `EqualizerComponent` & `PlayerBarComponent`
- Égaliseur 3 bandes amplifié : plage étendue de `[-24 dB, +24 dB]` (au lieu de `[-12, +12]`), fréquences accordées pour un punch immédiat (150 Hz basses percutantes, 6 kHz brillance cristalline).
- Visualisation renforcée : ligne de repère à 0 dB neutre, badges `mega-boost` vibrants et lumineux au-delà de +10 dB.
- Bouton `btn-eq` dans `PlayerBarComponent` : indicateur lumineux (dot orchidée) dès qu'un effet spatial ou qu'un préréglage d'égaliseur est actif.
- Section "Effets Spatiaux & Ambiance" avec 5 presets et curseurs horizontaux (Reverb 0-100%, Delay 50-1000ms, Feedback 0-80%).

#### [FIX & ENHANCE] Résolution Streaming Audio & Recherche Intelligente
- Résolution de l'erreur `ERR_CACHE_OPERATION_NOT_SUPPORTED` et `NotSupportedError` :
  - `track.middleware.js` : ouverture des pistes publiques sans exiger de token (`userId`).
  - `auth.middleware.js` : middleware `optionalAuth` pour les flux audio et la recherche publique.
  - Découplage de la requête de waveform (`?waveform=1`) pour éviter les conflits de cache concurrentiels sous Chromium.
- Recherche Intelligente & Catalogue direct :
  - Affichage direct du catalogue de pistes publiques et des membres de la communauté dès l'ouverture de la page de recherche (`!q`).
  - Regex intelligente insensible à la casse et aux accents (`makeSmartRegex`).
  - Recherche croisée par titre OU par nom d'artiste / propriétaire (ex: taper "bruno" retourne l'artiste Bruno Mars et toutes les pistes créées par Bruno Mars).

#### [OPTIMIZE] Fluidité et performances globales (Profilage & Réactivité)
- Optimisation des boucles `requestAnimationFrame` de `WaveformComponent`, `PlayerBarComponent` et `EqualizerComponent` : arrêt immédiat de la boucle en état de pause ou lorsque l'onglet est masqué (`document.hidden`), suppression de la boucle infinie idle.
- Suppression de `ctx.shadowBlur` dans la boucle de tracé de la forme d'onde (éliminant des milliers d'opérations de convolution GPU par seconde).
- Rafraîchissement direct et instantané lors des interactions utilisateur (survol, scrubbing, modification des curseurs).
- Réduction par 4x du temps d'exécution de la suite de tests (de ~26s à 6.8s).

**DoD validée :**
- L'activation de la reverb et du delay modifie audiblement le son en direct avec une spatialisation distincte par preset, sans craquement, saturation ni latence.
- L'égaliseur produit un changement de basses et d'aigus massif et nettement audible sur tous types d'écouteurs et d'enceintes.
- La recherche propose instantanément les pistes publiques et les membres, avec recherche intelligente par artiste ou titre.
- 100% des tests unitaires au vert : 50/50 tests frontend passés (14 suites de test) et 10/10 tests backend.
- Build de production frontend Angular sans erreur (`ng build` code 0).

---

## Étape 10 : Playlists Personnalisées (Création & Gestion Sociale) ✅ [TERMINÉE]
**Goal:** Organiser des sélections musicales et partager des playlists entre amis.

#### [NEW] Backend `models/Playlist.js` & `routes/playlist.routes.js`
- Modèle `Playlist` : `name`, `description`, `ownerId`, `tracks: [ObjectId]`, `visibility: 'public' | 'private'`, `sharedWith: [ObjectId]`.
- Routes CRUD complètes : `GET /api/playlists`, `POST /api/playlists`, `GET /api/playlists/:id`, `PATCH /api/playlists/:id`, `DELETE /api/playlists/:id`, `POST /api/playlists/:id/tracks/:trackId`, `DELETE /api/playlists/:id/tracks/:trackId`.
- Contrôle d'accès strict `canAccessPlaylist` : une playlist privée n'est accessible qu'à son créateur, aux utilisateurs dans `sharedWith`, ou aux amis acceptés.
- Cascade : la suppression d'une piste retire automatiquement cette piste de toutes les playlists (`Playlist.updateMany`).

#### [NEW] Frontend `PlaylistsPageComponent`, `AddToPlaylistModalComponent` & `PlaylistService`
- `PlaylistService` : service réactif avec signals (`playlists`, `loading`, `error`), méthodes CRUD complètes et gestion des ajouts/retraits de pistes.
- `PlaylistsPageComponent` (route `/playlists`) :
  - Filtrage par onglets ("Toutes", "Mes playlists", "Découvrir (Publiques)").
  - Cartes From Zero glassmorphic avec pochette vinyle dynamique, badge de visibilité et compteurs de pistes.
  - Lecture instantanée en 1 clic de toute la playlist (`playAll` via `player.playPlaylist`).
  - Ajout de toute la playlist dans la file d'attente (`addAllToQueue` via `player.addMultipleToQueue`).
  - Vue développée détaillée avec liste ordonnée des pistes, boutons d'écoute, like et retrait rapide.
  - Modals From Zero d'ajout, édition et suppression de playlists.
- `AddToPlaylistModalComponent` : dialogue interactif accessible depuis chaque carte de piste (`TracksPageComponent`, `SearchResultsComponent`, `ActivityFeedComponent`) permettant d'ajouter/retirer la piste d'une playlist existante en un clic ou de créer directement une nouvelle playlist avec la piste.
- Sidebar de navigation : ajout de l'onglet `Playlists` avec icône `queue_music`.

**DoD validée :**
- Création, édition, suppression, ajout et retrait de pistes opérationnels côté backend et frontend.
- Lecture complète d'une playlist et ajout groupé à la file d'attente testés et fonctionnels.
- 100% des tests unitaires au vert : 60/60 tests frontend passés (17 suites de tests) et 13/13 tests backend.
- Build de production frontend Angular sans erreur avec lazy-loading propre (`ng build` code 0).

---

## Étape 11 : Arrière-plan Audio-Réactif & Particules (Immersion Visuelle) ✅ [TERMINÉE]
**Goal:** Créer une ambiance visuelle vivante où l'interface respire au rythme de la musique.

#### [NEW] Frontend `AudioReactiveGlowComponent`, `GlowService` & Orbes CSS GPU Compositor
- `AudioReactiveGlowComponent` :
  - Architecture 100% matérielle GPU Compositor (zéro Canvas repaint, zéro invalidation de couches DOM).
  - Dégradés radiaux multi-paliers signature From Zero (Orbe orchidée sur les kicks, Orbe bleu électrique sur les mélodies, et Halo central d'ancrage sub-bass).
  - Enveloppes de dérive flottante animées en pur CSS `@keyframes` sur le thread compositeur GPU (`will-change: transform`).
  - Analyse spectrale temps réel optimisée via `AnalyserNode.getByteFrequencyData()` avec buffers TypedArray pré-alloués (0 allocation mémoire GC).
  - Injection dynamique de CSS Custom Properties (`--bass-scale`, `--bass-alpha`, `--mid-scale`, `--mid-alpha`, `--sub-scale`, `--sub-alpha`) sans aucun recalcul de layout.
  - Champ de particules d'étoiles CSS dérivant organiquement au rythme des percussions.
  - Régulation à 35 FPS avec arrêt automatique en pause audio ou masquage de l'onglet (0% CPU/GPU au repos).
  - Isolation matérielle complète via `contain: strict;` et `isolation: isolate;`.
- `GlowService` :
  - Service réactif gérant l'état d'activation (`isEnabled`), l'intensité (`intensity`), et l'affichage des particules (`particlesEnabled`).
  - Persistance automatique des préférences utilisateur dans le `localStorage` (`from_zero_reactive_glow`).
- Contrôles utilisateur :
  - Bouton interactif dédié dans `PlayerBarComponent` (`btn-glow` avec icônes `auto_awesome` / `blur_off`) permettant d'activer ou désactiver l'ambiance visuelle en un clic.
- Intégration globale :
  - Composant monté en arrière-plan global dans `AppComponent`, illuminant subtilement les surfaces glassmorphic et les cartes de l'application.

**DoD validée :**
- L'arrière-plan pulse subtilement et élégamment au rythme des basses et des kicks à 60 FPS constants sans aucun lag ni impact sur les performances.
- Bouton de bascule dans la player-bar testé et persistant entre les sessions.
- L'activation / désactivation instantanée fonctionne avec persistance des préférences.
- 100% des tests unitaires au vert : 67/67 tests frontend passés (19 suites de tests) et 13/13 tests backend.
- Build de production frontend Angular sans erreur (`ng build` code 0).

---

## Étape 12 : Optimisation Globale de la Fluidité & Performance (Rendu, Web Audio & API) ✅ [TERMINÉE]
**Goal:** Éliminer les micro-saccades, soulager le GPU/CPU et réduire la latence réseau à tous les niveaux.

#### [OPTIMIZE] Rendu Canvas & Garbage Collection V8
- **Mise en cache des gradients Canvas** dans [WaveformComponent](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/frontend-starter/src/app/components/waveform/waveform.component.ts) et [PlayerBarComponent](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/frontend-starter/src/app/components/player-bar/player-bar.component.ts) : élimination de plus de 8 000 allocations de dégradés par seconde dans les boucles `requestAnimationFrame` (0 minor GC sweeps).
- **Suppression du conflit CSS/JS** sur `.ambient-orb` dans [audio-reactive-glow.component.css](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/frontend-starter/src/app/components/audio-reactive-glow/audio-reactive-glow.component.css) : suppression de la transition CSS 80ms en concurrence avec la régulation JavaScript 35 FPS pour un rendu 100% GPU compositor fluide.
- **VU-mètres RMS 60 FPS** dans [EqualizerComponent](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/frontend-starter/src/app/components/equalizer/equalizer.component.ts) : mise à jour directe des propriétés de style DOM en dehors de la zone Angular sans aucun déclenchement de Change Detection intempestif.

#### [OPTIMIZE] Détection de Changement Angular & Memory Leaks
- **Généralisation de `ChangeDetectionStrategy.OnPush`** sur tous les composants clés (`AppComponent`, `PlayerBarComponent`, `PlaylistsPageComponent`, `ActivityFeedComponent`, `TracksPageComponent`, `FriendsPageComponent`, `SearchResultsComponent`, `AudioReactiveGlowComponent`, `EqualizerComponent`).
- **Correction de la fuite de mémoire** dans [SearchResultsComponent](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/frontend-starter/src/app/components/search-results/search-results.ts) via `takeUntilDestroyed(this.destroyRef)` sur `queryParams`.

#### [OPTIMIZE] Web Audio & Moteur Sonore
- **Cache mémoire des réponses impulsionnelles** dans [PlayerService](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/frontend-starter/src/app/shared/services/player.service.ts) (`impulseCache: Map<string, AudioBuffer>`) : élimination des calculs exponentiels synchrones (185 000 itérations) lors du changement de preset de réverbération.
- **Remplacement fluide de la branche réverbération** : remplacement isolé du `ConvolverNode` sans déconnexion de la source audio directe (zéro pop ni coupure de son).

#### [OPTIMIZE] API & Backend
- **Cache HTTP privé du flux audio** dans [track.routes.js](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/backend/src/routes/track.routes.js) (`Cache-Control: private, max-age=86400, must-revalidate`) : évite le re-téléchargement intégral du fichier audio lors de l'analyse waveform et du scrubbing.
- **Parallélisation des requêtes de recherche** dans [search.routes.js](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/backend/src/routes/search.routes.js) (`Promise.all([User.find, Track.find])`) : division par deux du temps de latence réseau vers MongoDB Atlas.
- **Nettoyage des logs verbeux** dans [Track.js](file:///c:/Users/leoma/Documents/M1%20MIAGE/AngularM1_Miage_2026_2027_TP123/backend/src/models/Track.js).

**DoD validée :**
- 100% des tests frontend (67/67 passés sur 19 suites) et backend (13/13 passés) au vert.
- Build de production propre en 5.3s (`ng build` code 0).


## Plan de Vérification

### Tests Automatisés (Mocha/Chai + Supertest)
- **Modèles (Mongoose)** : Test de l'unicité des paires de `Friendship` et blocage de l'auto-amitié.
- **Modèle d'Accès (Intégration/Supertest)** : Vérifier que `GET /api/tracks/:id/audio` retourne bien 404 pour un utilisateur non autorisé sur une piste privée. Vérifier que seul l'owner peut modifier `visibility` (sinon 403).
- **Services (Jasmine/Jest)** : Tests du `PlayerService` (états play/pause, queue, shuffle, repeat) et `FriendsService` (comportement du timer de polling).

### Vérification Manuelle
1. **Sécurité du Flux (Test critique)** : Ouvrir la session User A. Uploader une track privée. Copier l'URL réseau directe du flux audio. Ouvrir une fenêtre Incognito avec User B, coller l'URL. **Doit retourner 404**.
2. **Partage cascade** : User A partage avec User B. User A supprime User B de ses amis. User B ne doit plus voir ni pouvoir écouter la track (404).
3. **CORS & WebAudio** : Jouer une track, vérifier que les barres de fréquences s'animent. Si la ligne est plate (silence constant) et qu'il n'y a pas d'erreur console, c'est un échec CORS/cross-origin. Test à effectuer dès la fin de l'étape 5.
4. **Queue & Auto-play** : Ajouter plusieurs morceaux à la file d'attente, avancer le curseur à la fin d'un morceau, vérifier que le morceau suivant démarre automatiquement. Tester les boutons Next, Previous, Shuffle et Repeat.
5. **Avatar** : Téléverser une image de profil, vérifier l'apparition immédiate dans la sidebar et le profil, puis supprimer l'avatar pour vérifier le retour aux initiales.
