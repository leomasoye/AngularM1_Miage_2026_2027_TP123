# Rapport de Projet TP4 : Spotify × From Zero

## 1. Introduction et Vision du Projet

Ce document presente le travail realise dans le cadre du TP4, consistant a etendre un prototype d application de gestion de pistes audio pour en faire une veritable **application musicale sociale**, fortement inspiree de Spotify et reprenant l identite visuelle du recent album *From Zero* de Linkin Park.

Les objectifs principaux de cette iteration sont decoupes en trois axes majeurs, conformement au cahier des charges :
1. **Fichiers publics/prives et dimension sociale** : Partage entre amis, gestion de la visibilite, likes et suivi de l activite.
2. **Recherche de fichiers** : Moteur de recherche global pour trouver des pistes publiques et des utilisateurs.
3. **Amelioration de l experience d ecoute (Web Audio API)** : Creation d un lecteur audio avance integrant la Web Audio API pour la manipulation du son en temps reel (visualiseurs, egaliseur).

## 2. Phase de Conception et Choix Techniques

Avant de debuter l implementation, une phase de reflexion assistee par IA a permis de consolider l architecture et les choix techniques.

### 2.1. Interfaces Utilisateur (UI)
- **Design System "From Zero"** : Un theme sombre (Dark Mode) ultra-premium a ete concu, utilisant des nuances de charbon (`#0d0d0f`), d orchidee (`#9b3fd4`) et de bleu electrique (`#1a7fe8`). Des effets de glassmorphism et des degrades fluides rappellent l artwork organique de l album.
- **Librairie UI** : Pour accelerer le developpement tout en conservant une grande flexibilite, **Angular Material** a ete choisi. Ses composants (sliders, toggles, modales) seront redefinis stylistiquement pour s integrer parfaitement au theme "From Zero".

### 2.2. Choix d Implementation

Suite a l analyse des contraintes, les decisions suivantes ont ete arretees :

*   **Lecteur Audio (Web Audio API)** : Afin d assurer une compatibilite optimale avec le streaming (eviter de charger tout le fichier en memoire) tout en permettant des manipulations sonores, l architecture choisie repose sur une balise HTML `<audio>` classique connectee a un graphe Web Audio via `createMediaElementSource()`.
*   **Temps reel (Social)** : Pour la mise a jour des requetes d amis et de l activite, une approche par **HTTP Polling (toutes les 30 secondes)** a ete preferee aux WebSockets pour des raisons de simplicite et d adequation au perimetre du prototype.
*   **Priorisation des Effets Audio** : Le developpement se concentrera d abord sur la creation de **visualiseurs (Forme d onde, FFT)** et d un **Egaliseur (EQ)** fonctionnel. Les effets complexes (Reverb, Delay) sont relegues au rang de bonus (stretch goals).
*   **Backend & Base de Donnees** : Ajout de nouveaux modeles Mongoose (`Friendship`, `Share`) et extension du modele `Track` avec des champs `visibility` et `likes`. Les relations complexes seront gerees de maniere optimisee via des index composes.

## 3. Decoupage du Travail

Le projet a ete segmente en missions logiques afin d assurer un developpement iteratif et testable :

1.  **Refonte de l interface et integration d Angular Material** (Theme global, Sidebar, Layout).
2.  **Moteur de recherche et gestion de la visibilite (Public/Prive)**.
3.  **Reseau Social** : Systeme d amis (demandes, acceptations) et Likes.
4.  **Partage de fichiers et Flux d activite**.
5.  **Lecteur Audio avance avec Web Audio API** (Lecture de base et Visualiseurs).
6.  **Egaliseur et peaufinage UX**.

---

## 4. Réalisation - Étape 1 : Refonte UI et Angular Material
*Date d'implémentation : 2026*

**Objectif** : Mettre en place le Design System "From Zero" et Material Design 3.

**Travail réalisé** :
- Installation d'Angular Material (`@angular/material@22.2.2`).
- Configuration de `angular.json` pour compiler `src/styles.scss` en point d'entrée principal.
- Création du Design System complet dans `styles.scss` avec les variables CSS globales de la palette "From Zero" (fond Charbon `#0d0d0f`, nuances Orchidée et Bleu Électrique).
- Remplacement de la police par défaut par `Outfit` (Google Fonts) et intégration de `Material Symbols Outlined` dans `index.html`.
- Refonte structurelle globale :
  - **`app.html`** et **`app.css`** repensés en Flexbox pour inclure une `Sidebar` persistante à gauche et libérer un espace pour le futur `Player Portal` en bas.
  - **`login-page`** : Migration vers les composants Material M3 (`mat-form-field`, `matInput`, `mat-spinner`, `mat-flat-button`) enveloppés dans le style "Glassmorphism" `glass-card`.

**Validation (DoD respecté)** : 
- L'application démarre et compile correctement avec Material.
- Le layout principal avec Sidebar est opérationnel sur les routes nécessitant une authentification.
- Le thème global est unifié et fidèle aux maquettes de conception.


## 4. Réalisation - Étape 0 : Modèle d'accès et Refactoring Backend
*Date d'implémentation : 2026*

**Objectif** : Refactoriser le backend (séparation des routes) et mettre en place le modèle d'accès sécurisé (`canAccessTrack`, `visibility`).

**Travail réalisé** :
- **Refactoring** :
  - Découpage du fichier monolithique `app.js` en routeurs distincts : `routes/auth.routes.js`, `routes/user.routes.js`, `routes/track.routes.js`.
  - Extraction de la configuration de Multer dans `middleware/upload.middleware.js`.
  - Extraction de la vérification JWT dans `middleware/auth.middleware.js`.
- **Modèle de données** :
  - Modification du modèle `Track` (`models/Track.js`) pour ajouter un champ `visibility` (`'public' | 'private'`) avec indexation, et un tableau `likes` (préparation pour l'étape 3).
  - Mise à jour de la méthode `toPublic()` pour retourner ces nouveaux champs.
- **Sécurité et Contrôle d'accès** :
  - Création de `middleware/track.middleware.js` contenant :
    - `canAccessTrack(userId, track)` : Autorise l'accès si l'utilisateur est le propriétaire ou si la piste est publique.
    - `requireOwner(req, res, next)` : Restreint les actions de modification/suppression au propriétaire.
  - Sécurisation du endpoint `GET /api/tracks/:id/audio` pour renvoyer une erreur `404` si l'utilisateur n'a pas l'autorisation d'accéder à la piste (conformément aux règles métier).

**Validation (DoD respecté)** : 
- Le backend démarre sans erreur.
- La structure est propre et modulaire.
- La sécurité est en place pour interdire l'accès aux flux audio privés non autorisés.

*(La suite de ce rapport sera complétée au fur et à mesure de l'implémentation, détaillant les fonctionnalités réalisées, les tests exécutés et les difficultés rencontrées).*


