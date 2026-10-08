import express from "express";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Track } from "../models/Track.js";
import { auth } from "../middleware/auth.middleware.js";
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

router.get("/:id/audio", auth, loadTrack, async (req, res, next) => {
  try {
    if (!canAccessTrack(req.auth.sub, req.track)) {
      return res.status(404).json({ message: "Piste inconnue" }); // Renvoie 404 comme demandé
    }

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

export default router;
