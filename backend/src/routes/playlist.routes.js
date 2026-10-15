import express from "express";
import mongoose from "mongoose";
import { Playlist } from "../models/Playlist.js";
import { Track } from "../models/Track.js";
import { Friendship } from "../models/Friendship.js";
import { auth, optionalAuth } from "../middleware/auth.middleware.js";
import { canAccessTrack } from "../middleware/track.middleware.js";

const router = express.Router();

/**
 * Vérifie si un utilisateur a le droit d'accéder à une playlist.
 * - Public : accessible à tous
 * - Privée : accessible au propriétaire, aux utilisateurs dans sharedWith, et aux amis acceptés du propriétaire.
 */
export async function canAccessPlaylist(userId, playlist) {
  if (!playlist) return false;
  if (playlist.visibility === "public") return true;
  if (!userId) return false;

  const ownerIdStr = String(playlist.ownerId?._id || playlist.ownerId);
  if (ownerIdStr === String(userId)) return true;

  if (
    Array.isArray(playlist.sharedWith) &&
    playlist.sharedWith.some((id) => String(id?._id || id) === String(userId))
  ) {
    return true;
  }

  // Vérifier si l'utilisateur est ami accepté avec le propriétaire de la playlist
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  try {
    const isFriend = await Friendship.exists({
      $or: [
        { requesterId: userId, addresseeId: ownerIdStr, status: "accepted" },
        { requesterId: ownerIdStr, addresseeId: userId, status: "accepted" },
      ],
    });
    return Boolean(isFriend);
  } catch {
    return false;
  }
}

// GET /api/playlists - Liste des playlists accessibles ou filtrées
router.get("/", optionalAuth, async (req, res, next) => {
  try {
    const filterType = req.query.filter; // 'my' | 'friends' | 'public' | undefined
    const userId = req.auth?.sub;

    let mongoFilter = {};

    if (filterType === "my") {
      if (!userId) {
        return res.status(401).json({ message: "Authentification requise" });
      }
      mongoFilter = { ownerId: userId };
    } else if (filterType === "public") {
      mongoFilter = { visibility: "public" };
    } else if (userId) {
      // Trouver les IDs des amis acceptés
      const friendships = await Friendship.find({
        $or: [{ requesterId: userId }, { addresseeId: userId }],
        status: "accepted",
      }).lean();

      const friendIds = friendships.map((f) =>
        String(f.requesterId) === userId ? f.addresseeId : f.requesterId
      );

      mongoFilter = {
        $or: [
          { visibility: "public" },
          { ownerId: userId },
          { sharedWith: userId },
          { ownerId: { $in: friendIds } },
        ],
      };
    } else {
      mongoFilter = { visibility: "public" };
    }

    const playlists = await Playlist.find(mongoFilter)
      .populate("ownerId", "name avatarUrl")
      .populate({
        path: "tracks",
        select: "title originalName mimeType size visibility likes ownerId createdAt",
        populate: { path: "ownerId", select: "name" },
      })
      .sort({ createdAt: -1 });

    res.json(playlists.map((p) => p.toPublic()));
  } catch (error) {
    next(error);
  }
});

// POST /api/playlists - Créer une nouvelle playlist
router.post("/", auth, async (req, res, next) => {
  try {
    const { name, description, visibility } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Le nom de la playlist est obligatoire" });
    }

    const playlist = await Playlist.create({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      visibility: visibility === "private" ? "private" : "public",
      ownerId: req.auth.sub,
      tracks: [],
    });

    await playlist.populate("ownerId", "name avatarUrl");
    res.status(201).json(playlist.toPublic());
  } catch (error) {
    next(error);
  }
});

// GET /api/playlists/:id - Détails d'une playlist avec ses pistes
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    const playlist = await Playlist.findById(req.params.id)
      .populate("ownerId", "name avatarUrl")
      .populate({
        path: "tracks",
        select: "title originalName mimeType size visibility likes ownerId createdAt",
        populate: { path: "ownerId", select: "name" },
      });

    if (!playlist) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    const hasAccess = await canAccessPlaylist(req.auth?.sub, playlist);
    if (!hasAccess) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    res.json(playlist.toPublic());
  } catch (error) {
    next(error);
  }
});

// PATCH /api/playlists/:id - Modifier le nom, la description ou la visibilité
router.patch("/:id", auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    if (String(playlist.ownerId) !== req.auth.sub) {
      return res.status(403).json({ message: "Action non autorisée sur cette playlist" });
    }

    const { name, description, visibility } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Le nom ne peut pas être vide" });
      }
      playlist.name = name.trim();
    }

    if (description !== undefined) {
      playlist.description = typeof description === "string" ? description.trim() : "";
    }

    if (visibility !== undefined) {
      if (visibility !== "public" && visibility !== "private") {
        return res.status(400).json({ message: "Visibilité invalide" });
      }
      playlist.visibility = visibility;
    }

    await playlist.save();
    await playlist.populate("ownerId", "name avatarUrl");
    await playlist.populate({
      path: "tracks",
      select: "title originalName mimeType size visibility likes ownerId createdAt",
      populate: { path: "ownerId", select: "name" },
    });

    res.json(playlist.toPublic());
  } catch (error) {
    next(error);
  }
});

// DELETE /api/playlists/:id - Supprimer une playlist
router.delete("/:id", auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    if (String(playlist.ownerId) !== req.auth.sub) {
      return res.status(403).json({ message: "Action non autorisée sur cette playlist" });
    }

    await Playlist.findByIdAndDelete(playlist.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// POST /api/playlists/:id/tracks/:trackId - Ajouter une piste à la playlist
router.post("/:id/tracks/:trackId", auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.trackId)) {
      return res.status(404).json({ message: "Ressource inconnue" });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    if (String(playlist.ownerId) !== req.auth.sub) {
      return res.status(403).json({ message: "Action non autorisée sur cette playlist" });
    }

    const track = await Track.findById(req.params.trackId);
    if (!track) {
      return res.status(404).json({ message: "Piste inconnue" });
    }

    const accessible = await canAccessTrack(req.auth.sub, track);
    if (!accessible) {
      return res.status(404).json({ message: "Piste inconnue" });
    }

    // Utilisation de addToSet pour éviter les doublons de piste
    playlist.tracks.addToSet(track._id);
    await playlist.save();

    await playlist.populate("ownerId", "name avatarUrl");
    await playlist.populate({
      path: "tracks",
      select: "title originalName mimeType size visibility likes ownerId createdAt",
      populate: { path: "ownerId", select: "name" },
    });

    res.json(playlist.toPublic());
  } catch (error) {
    next(error);
  }
});

// DELETE /api/playlists/:id/tracks/:trackId - Retirer une piste de la playlist
router.delete("/:id/tracks/:trackId", auth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.trackId)) {
      return res.status(404).json({ message: "Ressource inconnue" });
    }

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist inconnue" });
    }

    if (String(playlist.ownerId) !== req.auth.sub) {
      return res.status(403).json({ message: "Action non autorisée sur cette playlist" });
    }

    playlist.tracks.pull(req.params.trackId);
    await playlist.save();

    await playlist.populate("ownerId", "name avatarUrl");
    await playlist.populate({
      path: "tracks",
      select: "title originalName mimeType size visibility likes ownerId createdAt",
      populate: { path: "ownerId", select: "name" },
    });

    res.json(playlist.toPublic());
  } catch (error) {
    next(error);
  }
});

export default router;
