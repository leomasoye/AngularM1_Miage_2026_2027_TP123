# 🎵 Guitar Practice Cloud — Spotify × From Zero

Bienvenue sur le dépôt du projet de **Guitar Practice Cloud / Plateforme Musicale Sociale**, développé en **Angular 18+ (Standalone)** et **Node.js / Express / MongoDB Atlas** par Léo Masoyé.

Ce projet regroupe à la fois le socle académique des **3 Travaux Pratiques (TP1, TP2, TP3)** et leur extension majeure en **Projet Final (Spotify × From Zero)**.

lien de vidéo de présentation : 

---

## 🧭 Navigation dans les étapes du projet (Git Tags)

Le dépôt a été balisé avec des tags Git annotés pour permettre à l'enseignant de se positionner instantanément à la fin de chaque séance ou au démarrage du projet :

| Tag / Branche | Étape | Description & Contenu |
| :--- | :--- | :--- |
| `tp1` | **Fin du TP1** | Inscription, connexion, gestion du JWT, profil réactif avec Angular Signals. |
| `tp2` | **Fin du TP2** | Bibliothèque avec pagination serveur, upload audio validé et lecture sécurisée via Blob. |
| `tp3` | **Fin du TP3** | Suppression de piste, barre de progression temps réel de l'upload, suite de tests unitaires. |
| `debut-projet` | **Point de départ projet** | État initial du repository avant le début du développement du TP4 / Projet. |
| `main` | **Projet Finalisé** | Application complète Spotify-like (thème *From Zero*, Web Audio API, amis, likes, playlists). |

```bash
# Pour inspecter un TP particulier :
git checkout tp1
git checkout tp2
git checkout tp3

# Pour revenir sur le projet complet :
git checkout main
```

---

## 📖 Vue d'ensemble du parcours & des TP

### 🔹 TP1 — Authentification & Profil Réactif
- **Objectif :** Poser les bases de l'authentification et de l'état réactif de l'utilisateur.
- **Réalisations :**
  - Formulaires réactifs pour `/login` et `/register` avec validation en temps réel.
  - Stockage local sécurisé du token JWT et injection automatique via un intercepteur HTTP.
  - Gestion de l'état utilisateur via des **Angular Signals** (`currentUser`) et mise à jour dynamique du profil (`PUT /api/users/me`).
- 📄 **Documentation & Preuves :** Section TP1 de [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md) (captures réseau et explications).

### 🔹 TP2 — Bibliothèque Audio, Pagination Serveur & Upload
- **Objectif :** Manipuler des flux de données et des fichiers multimédias sans surcharger la mémoire.
- **Réalisations :**
  - Pagination côté serveur (`skip` / `limit` dans MongoDB) évitant le découpage local en mémoire.
  - Formulaire d'upload multipart (`audio` + `title`) avec contrôles pré-envoi (taille < 25 Mo, formats acceptés).
  - Lecture audio authentifiée : transit par `HttpClient` avec intercepteur JWT, conversion en `Blob`, génération d'un `ObjectURL` et révocation propre à la destruction (`URL.revokeObjectURL`).
- 📄 **Documentation & Preuves :** Section TP2 de [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md).

### 🔹 TP3 — Fiabilisation, Progression d'Upload & Tests Unitaires
- **Objectif :** Sécuriser et fiabiliser le frontend avant l'extension projet.
- **Réalisations :**
  - Suppression de piste avec confirmation utilisateur et gestion stricte des autorisations côté serveur.
  - Suivi en temps réel de la progression d'envoi grâce aux événements HTTP (`HttpEventType.UploadProgress`).
  - Suite de tests unitaires avec `HttpTestingController` pour isoler les services et les guards sans dépendance réseau ou base de données.
- 📄 **Documentation & Preuves :** Section TP3 de [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md).

---

## 🚀 Le Projet Final : Spotify × From Zero

À partir du socle des 3 TP, l'application a été transformée en une **plateforme musicale et sociale** haut de gamme, inspirée des fonctionnalités phares de Spotify et de l'identité visuelle de l'album *From Zero* de Linkin Park.

### 🌟 Fonctionnalités clés :
1. **Design System Évolué & Multi-Thématisation (7 thèmes dynamiques) :**
   - Palette sombre immersive initiale *From Zero* (charbon, orchidée, bleu électrique), désormais déclinable en **7 thèmes complets** personnalisables en direct (*From Zero*, *Cyberpunk Neon*, *Emerald Matrix*, *Sunset Crimson*, *Sapphire Deep*, *Amethyst Purple*, *Monochrome Stealth*).
   - Page dédiée **Paramètres** (`/settings`) avec aperçu temps réel de l'orbe de couleur, personnalisation du volume par défaut et bascules d'effets visuels.
   - Adaptation intégrale de tous les éléments UI et graphiques : pochettes de playlists fluides (`--gradient-marble`), avatars sans photo, barres de volume, égaliseur et canvas Web Audio.
   - Typographie Google Font *Outfit*, composants Angular Material 3 personnalisés et surfaces en glassmorphism.
2. **Gestion de la Visibilité & Sécurité :**
   - Contrôle granulaire par piste : `public` (accessible à tous) ou `private` (accessible uniquement au propriétaire et aux amis autorisés).
   - Sécurisation du flux de streaming audio avec réponse 404 neutre en cas d'accès non autorisé et support des en-têtes CORS pour la Web Audio API.
3. **Dimension Sociale & Partage :**
   - Système d'amis complet : recherche d'utilisateurs, envoi de requêtes, acceptation / refus et suppression d'amis avec cascade sur les partages.
   - Système de « J'aime » (Likes) optimiste en temps réel sur les pistes.
   - Modale de partage direct de pistes privées à des amis sélectionnés.
   - Fil d'activité (Activity Feed) chronologique avec pagination par curseur et polling intelligent toutes les 30s (mis en pause hors écran).
   - Avatars utilisateur personnalisés (upload JPEG/PNG/WebP ou initiales dynamiques stylisées).
4. **Recherche Globale Intelligente :**
   - Moteur de recherche instantané insensible aux accents et à la casse, filtrant pistes et membres de la communauté (sans fuite d'adresses e-mail).
   - Affichage immédiat du catalogue complet de découverte lorsque la barre est vide.
5. **Lecteur Audio Avancé, Web Audio API & Effets Spatiaux :**
   - Barre de lecture persistante en bas d'écran avec contrôles complets : lecture/pause, volume avec jauge colorée, précédent, suivant, lecture aléatoire (*Shuffle*), répétition (*Repeat* none/all/one), et file d'attente interactive (*Queue Drawer*).
   - **Waveform interactive** : forme d'onde décodée en 120 barres d'amplitude (`decodeAudioData`), scrubbing fluide, survol avec timestamp précis et accessibilité ARIA.
   - **Égaliseur 3 bandes amplifié** : Basses, Médiums, Aigus (plage `[-24 dB, +24 dB]`) avec 4 préréglages, persistance `localStorage` et VU-mètres stéréo réactifs (canaux Gauche & Droite) avec indicateur de crête.
   - **Effets spatiaux en direct** : Réverbération par convolution (`ConvolverNode` simulant Club, Concert Hall, Arena) et Delay/Écho avec feedback stéréo (`DelayNode`).
6. **Immersion Visuelle & Arrière-plan Audio-Réactif :**
   - Composant d'ambiance 100% matériel sur GPU Compositor (`AudioReactiveGlowComponent`) pulsant au rythme des kicks et des fréquences musicales, avec champ de poussières d'étoiles CSS dérivant en temps réel selon les teintes du thème choisi.
7. **Gestion des Playlists :**
   - Création de playlists publiques ou privées, ajout/retrait instantané de morceaux depuis n'importe quelle vue (`AddToPlaylistModal`), lecture continue d'une playlist complète en 1 clic et ajout groupé à la file d'attente.
8. **Qualité & Suite de Tests :**
   - **79 tests unitaires frontend** (21 fichiers de test Vitest) et **13 tests backend** (Mocha/Chai/Supertest) 100% au vert.
   - Compilation et bundling de production sans avertissement (`ng build`).

---

## 📚 Documents de référence indispensables

| Document | Rôle & Importance |
| :--- | :--- |
| 🎯 **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** | **Le plan d'architecture et de développement du projet.** Indispensable pour comprendre la conception détaillée, les modèles Mongoose, les choix techniques, les étapes d'exécution et les critères de validation. |
| 🤖 **[RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md)** | **Rapport d'usage de l'IA pour les TP1, TP2 et TP3.** Contient les explications détaillées, captures d'écrans du réseau et réponses aux questions conceptuelles. |
| 📊 **[REPORT.md](REPORT.md)** | **Rapport de synthèse du TP4 / Projet Spotify × From Zero.** Bilan de conception, choix d'architecture et fonctionnalités implémentées. |
| 📋 **[API_CONTRACT.md](API_CONTRACT.md)** | **Spécification de l'API backend.** Contrat RESTful détaillant les routes, paramètres, statuts HTTP et formats JSON. |
| ⚙️ **[ATLAS_SETUP.md](ATLAS_SETUP.md)** | Guide de configuration pour la base de données MongoDB Atlas. |
| 📝 **Sujets des TP** | Sujets originaux des travaux pratiques : [TP1](SUJET_ETUDIANT_TP1.md), [TP2](SUJET_ETUDIANT_TP2.md), [TP3](SUJET_ETUDIANT_TP3.md). |

---

## 💻 Démarrage rapide

### 1. Prérequis
- **Node.js** 22 ou plus récent
- Un compte **MongoDB Atlas** configuré (voir [ATLAS_SETUP.md](ATLAS_SETUP.md))
- Navigateur récent supportant la Web Audio API

### 2. Démarrer le Backend
```bash
cd backend
cp .env.example .env    # Configurer votre URI MongoDB Atlas et JWT_SECRET
npm install
npm start
```
Le serveur backend démarre sur `http://localhost:3000`.

### 3. Démarrer le Frontend Angular
Dans un second terminal :
```bash
cd frontend-starter
npm install
npm start
```
L'application est accessible sur `http://localhost:4200`.

> **Compte de démonstration pré-configuré :**
> - **Email :** `demo@example.com`
> - **Mot de passe :** `Demo1234!`

