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
1. **Design System "From Zero" & Angular Material (M3) :**
   - Palette sombre immersive : fond charbon (`#0d0d0f`), touches d'orchidée (`#9b3fd4`) et de bleu électrique (`#1a7fe8`).
   - Typographie moderne Google Font *Outfit*, composants M3 personnalisés et cartes en glassmorphism.
2. **Gestion de la Visibilité & Sécurité :**
   - Contrôle granulaire par piste : `public` (accessible à tous) ou `private` (accessible uniquement au propriétaire et aux amis autorisés).
   - Sécurisation du flux de streaming audio avec réponse 404 neutre en cas d'accès non autorisé.
3. **Dimension Sociale & Partage :**
   - Système d'amis complet : recherche d'utilisateurs, envoi de requêtes, acceptation / refus et suppression d'amis.
   - Système de « J'aime » (Likes) en temps réel sur les pistes.
   - Modal de partage direct de pistes privées à des amis sélectionnés.
   - Fil d'activité (Activity Feed) présentant les dernières pistes partagées par vos amis.
4. **Recherche Globale Intelligente :**
   - Moteur de recherche instantané filtrant pistes et profils utilisateurs (sans exposition d'adresses e-mail).
5. **Lecteur Audio Avancé & Web Audio API :**
   - Barre de lecture persistante en bas d'écran avec contrôle complet de la lecture.
   - Visualisations audio réactives en temps réel (Audio Reactive Glow, visualiseur de fréquences et particules dynamiques).
   - Égaliseur audio (EQ) et gestion du volume.
6. **Gestion des Playlists :**
   - Création de playlists personnalisées, ajout/retrait de morceaux et écoute continue.

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

