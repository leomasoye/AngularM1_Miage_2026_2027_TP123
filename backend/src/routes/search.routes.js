import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { Track } from "../models/Track.js";
import { User } from "../models/User.js";
import { optionalAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rate limiter: maximum 60 recherches par minute
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { message: "Trop de requêtes, veuillez patienter." },
});

// Cache mémoire court pour les requêtes de recherche fréquentes (TTL 20s)
const searchCache = new Map();
const SEARCH_CACHE_TTL = 20 * 1000;

// Helper pour échapper les regex afin de prévenir les attaques ReDoS
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Générateur de regex insensible à la casse et aux accents pour une recherche intelligente
function makeSmartRegex(text) {
  const escaped = escapeRegex(text.trim());
  const accentMap = {
    a: "[aàáâãäåAÀÁÂÃÄÅ]",
    e: "[eèéêëEÈÉÊË]",
    i: "[iìíîïIÌÍÎÏ]",
    o: "[oòóôõöOÒÓÔÕÖ]",
    u: "[uùúûüUÙÚÛÜ]",
    c: "[cçCÇ]",
    n: "[nñNÑ]",
  };
  const pattern = escaped.replace(/[aeioucn]/gi, (char) => {
    const lower = char.toLowerCase();
    return accentMap[lower] || char;
  });
  return new RegExp(pattern, "i");
}

router.get("/", optionalAuth, searchLimiter, async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ users: [], tracks: [] });
    }
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const type = req.query.type || "all";

    // Si aucune requête, renvoyer directement la liste des pistes publiques et des utilisateurs (catalogue)
    if (!q) {
      const defaultCacheKey = `catalog:${type}`;
      const cached = searchCache.get(defaultCacheKey);
      if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
        return res.json(cached.data);
      }

      const results = { users: [], tracks: [] };
      const promises = [];

      if (type === "all" || type === "users") {
        promises.push(
          User.find({})
            .sort({ createdAt: -1 })
            .limit(20)
            .select("-email -passwordHash")
            .lean()
            .then((users) => {
              results.users = users.map((u) => ({
                id: String(u._id),
                name: u.name,
                avatarUrl: u.avatarUrl || null,
              }));
            })
        );
      }

      if (type === "all" || type === "tracks") {
        promises.push(
          Track.find({ visibility: "public" })
            .sort({ createdAt: -1 })
            .limit(30)
            .select("-storedName")
            .populate("ownerId", "name avatarUrl")
            .lean()
            .then((tracks) => {
              results.tracks = tracks.map((t) => ({
                id: String(t._id),
                title: t.title,
                ownerId: String(t.ownerId?._id || t.ownerId),
                ownerName: t.ownerId?.name || "Artiste",
                mimeType: t.mimeType,
                size: t.size,
                visibility: t.visibility,
                likes: t.likes ? t.likes.map((l) => String(l)) : [],
                createdAt: t.createdAt,
              }));
            })
        );
      }

      await Promise.all(promises);
      searchCache.set(defaultCacheKey, { data: results, timestamp: Date.now() });
      return res.json(results);
    }

    const cacheKey = `${type}:${q.toLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      return res.json(cached.data);
    }

    const smartRegex = makeSmartRegex(q);
    const results = { users: [], tracks: [] };

    // 1. Recherche intelligente des utilisateurs correspondants (ex: "bruno" -> "Bruno Mars")
    const matchedUsers = await User.find({ name: smartRegex })
      .limit(25)
      .select("-email -passwordHash")
      .lean();

    if (type === "all" || type === "users") {
      results.users = matchedUsers.map((u) => ({
        id: String(u._id),
        name: u.name,
        avatarUrl: u.avatarUrl || null,
      }));
    }

    // 2. Recherche intelligente des pistes :
    //    - correspond au titre OU
    //    - appartient à l'un des artistes/utilisateurs trouvés (ex: titre de Bruno Mars même si le titre ne contient pas "bruno")
    if (type === "all" || type === "tracks") {
      const matchedUserIds = matchedUsers.map((u) => u._id);
      const trackFilter = {
        visibility: "public",
        $or: [
          { title: smartRegex },
          ...(matchedUserIds.length > 0 ? [{ ownerId: { $in: matchedUserIds } }] : []),
        ],
      };

      const matchedTracks = await Track.find(trackFilter)
        .sort({ createdAt: -1 })
        .limit(30)
        .select("-storedName")
        .populate("ownerId", "name avatarUrl")
        .lean();

      results.tracks = matchedTracks.map((t) => ({
        id: String(t._id),
        title: t.title,
        ownerId: String(t.ownerId?._id || t.ownerId),
        ownerName: t.ownerId?.name || "Artiste",
        mimeType: t.mimeType,
        size: t.size,
        visibility: t.visibility,
        likes: t.likes ? t.likes.map((l) => String(l)) : [],
        createdAt: t.createdAt,
      }));
    }

    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    if (searchCache.size > 100) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey) searchCache.delete(oldestKey);
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
