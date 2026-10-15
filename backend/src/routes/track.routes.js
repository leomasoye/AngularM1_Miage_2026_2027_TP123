import express from "express";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Track } from "../models/Track.js";
import { Share } from "../models/Share.js";
import { Friendship } from "../models/Friendship.js";
import { Playlist } from "../models/Playlist.js";
import { auth, optionalAuth } from "../middleware/auth.middleware.js";
import { canAccessTrack, requireOwner } from "../middleware/track.middleware.js";
import { upload, UPLOADS } from "../middleware/upload.middleware.js";

const router = express.Router();

// Middleware to preload track by ID
async function loadTrack(req, res, next) {
  try {
    const track = await Track.findById(req.params.id).select("+storedName");
    if (!track) {
      return res.status(404).json({ message: "Piste inconnue" });
    }
    req.track = track;
    next();
  } catch (error) {
    next(error);
  }
}

router.get("/shared", auth, async (req, res, next) => {
  try {
    const shares = await Share.find({ sharedWithId: req.auth.sub })
      .populate({
        path: "trackId",
        select: "-storedName",
        populate: { path: "ownerId", select: "name" },
      })
      .sort({ createdAt: -1 });

    const items = shares
      .filter((s) => s.trackId)
      .map((s) => {
        const track = s.trackId;
        return {
          id: String(track._id),
          title: track.title,
          originalName: track.originalName,
          mimeType: track.mimeType,
          size: track.size,
          visibility: track.visibility,
          likes: track.likes ? track.likes.map((l) => String(l)) : [],
          ownerId: String(track.ownerId?._id || track.ownerId),
          ownerName: track.ownerId?.name || "Ami",
          isShared: true,
          createdAt: track.createdAt,
        };
      });

    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get("/", auth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
    const filter = { ownerId: req.auth.sub }; // Pour l'instant, on liste que ses propres pistes

    const [items, total] = await Promise.all([
      Track.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-storedName")
        .lean(),
      Track.countDocuments(filter),
    ]);

    const publicItems = items.map((track) => ({
      ...track,
      id: String(track._id),
      _id: undefined,
      likes: Array.isArray(track.likes) ? track.likes.map((id) => String(id)) : [],
    }));

    res.json({
      items: publicItems,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", auth, upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Fichier audio requis" });
    }

    const track = await Track.create({
      ownerId: req.auth.sub,
      title: req.body.title || req.file.originalname,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      visibility: req.body.visibility || "private"
    });

    res.status(201).json(track.toPublic());
  } catch (error) {
    if (req.file) {
      const uploadedPath = path.join(UPLOADS, req.file.filename);
      await fsPromises.unlink(uploadedPath).catch(() => {});
    }
    next(error);
  }
});

router.options("/:id/audio", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.sendStatus(204);
});

router.get("/:id/audio", optionalAuth, loadTrack, async (req, res, next) => {
  try {
    const userId = req.auth?.sub;
    if (!(await canAccessTrack(userId, req.track))) {
      return res.status(404).json({ message: "Piste inconnue" }); // Renvoie 404 comme demandé
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=86400, must-revalidate");

    const audioPath = path.join(UPLOADS, req.track.storedName);
    res.type(req.track.mimeType);
    res.sendFile(audioPath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", auth, loadTrack, requireOwner, async (req, res, next) => {
  try {
    await Track.findByIdAndDelete(req.track.id);
    await Share.deleteMany({ trackId: req.track.id });
    await Playlist.updateMany({ tracks: req.track.id }, { $pull: { tracks: req.track.id } });
    
    const audioPath = path.join(UPLOADS, req.track.storedName);
    try {
      await fsPromises.unlink(audioPath);
    } catch (error) {
      console.error(`[tracks] Fichier audio non supprimé : ${audioPath}`, error);
      return res.status(500).json({
        message: "Métadonnée supprimée, mais fichier audio non supprimé",
      });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/visibility", auth, loadTrack, requireOwner, async (req, res, next) => {
  try {
    const { visibility } = req.body;
    if (visibility !== "public" && visibility !== "private") {
      return res.status(400).json({ message: "Visibilité invalide" });
    }

    req.track.visibility = visibility;
    await req.track.save();

    res.json(req.track.toPublic());
  } catch (error) {
    next(error);
  }
});

router.post("/:id/like", auth, loadTrack, async (req, res, next) => {
  try {
    if (!(await canAccessTrack(req.auth.sub, req.track))) {
      return res.status(404).json({ message: "Piste inconnue" });
    }

    req.track.likes.addToSet(req.auth.sub);
    await req.track.save();
    res.json(req.track.toPublic());
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/like", auth, loadTrack, async (req, res, next) => {
  try {
    if (!(await canAccessTrack(req.auth.sub, req.track))) {
      return res.status(404).json({ message: "Piste inconnue" });
    }

    req.track.likes.pull(req.auth.sub);
    await req.track.save();
    res.json(req.track.toPublic());
  } catch (error) {
    next(error);
  }
});

// Récupérer les partages d'une piste
router.get("/:id/shares", auth, loadTrack, requireOwner, async (req, res, next) => {
  try {
    const shares = await Share.find({ trackId: req.track.id })
      .populate("sharedWithId", "name")
      .sort({ createdAt: -1 });

    const mapped = shares.map((s) => ({
      id: String(s._id),
      userId: String(s.sharedWithId?._id || s.sharedWithId),
      userName: s.sharedWithId?.name || "Ami",
      createdAt: s.createdAt,
    }));

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

// Partager une piste avec un ami
router.post("/:id/share/:userId", auth, loadTrack, requireOwner, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    if (targetUserId === req.auth.sub) {
      return res.status(400).json({ message: "Vous ne pouvez pas partager une piste avec vous-même." });
    }

    const isFriend = await Friendship.exists({
      $or: [
        { requesterId: req.auth.sub, addresseeId: targetUserId, status: "accepted" },
        { requesterId: targetUserId, addresseeId: req.auth.sub, status: "accepted" },
      ],
    });

    if (!isFriend) {
      return res.status(400).json({ message: "Vous ne pouvez partager qu'avec un ami accepté." });
    }

    let share = await Share.findOne({ trackId: req.track.id, sharedWithId: targetUserId });
    if (!share) {
      share = await Share.create({
        trackId: req.track.id,
        ownerId: req.auth.sub,
        sharedWithId: targetUserId,
      });
    }

    res.status(201).json(share.toPublic());
  } catch (error) {
    next(error);
  }
});

// Supprimer le partage d'une piste avec un ami
router.delete("/:id/share/:userId", auth, loadTrack, requireOwner, async (req, res, next) => {
  try {
    await Share.findOneAndDelete({
      trackId: req.track.id,
      sharedWithId: req.params.userId,
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;


