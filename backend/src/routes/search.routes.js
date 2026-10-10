import express from "express";
import rateLimit from "express-rate-limit";
import { Track } from "../models/Track.js";
import { User } from "../models/User.js";
import { auth } from "../middleware/auth.middleware.js";

const router = express.Router();

// Rate limiter: maximum 30 recherches par minute
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { message: "Trop de requêtes, veuillez patienter." },
});

// Helper pour échapper les regex afin de prévenir les attaques ReDoS
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

router.get("/", auth, searchLimiter, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const type = req.query.type || "all";

    if (!q) {
      return res.json({ users: [], tracks: [] });
    }

    const safeRegex = new RegExp(escapeRegex(q), "i");
    const results = { users: [], tracks: [] };

    const promises = [];

    if (type === "all" || type === "users") {
      promises.push(
        User.find({ name: safeRegex })
          .limit(20)
          .select("-email -passwordHash") // Ne JAMAIS renvoyer l'email dans la recherche
          .lean()
          .then(users => {
            results.users = users.map(u => ({ id: String(u._id), name: u.name }));
          })
      );
    }

    if (type === "all" || type === "tracks") {
      promises.push(
        Track.find({ title: safeRegex, visibility: "public" })
          .limit(20)
          .select("-storedName")
          .populate("ownerId", "name") // On ramène juste le nom du propriétaire
          .lean()
          .then(tracks => {
            results.tracks = tracks.map(t => ({
              id: String(t._id),
              title: t.title,
              ownerId: String(t.ownerId?._id || t.ownerId),
              ownerName: t.ownerId?.name || "Inconnu",
              mimeType: t.mimeType,
              size: t.size,
              visibility: t.visibility,
              likes: t.likes ? t.likes.map(l => String(l)) : [],
              createdAt: t.createdAt
            }));
          })
      );
    }

    await Promise.all(promises);

    res.json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
