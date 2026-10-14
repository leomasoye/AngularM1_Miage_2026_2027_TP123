import express from "express";
import path from "node:path";
import fs from "node:fs";
import { User } from "../models/User.js";
import { auth } from "../middleware/auth.middleware.js";
import { avatarUpload, AVATARS_DIR } from "../middleware/avatar-upload.middleware.js";

const router = express.Router();

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) {
      console.warn(`[user] Profil introuvable : ${req.auth.sub}`);
      return res.status(404).json({ message: "Utilisateur inconnu" });
    }

    console.log(`[user] Profil envoyé : ${user.id}`);
    res.json(user.toPublic());
  } catch (error) {
    console.error("[user] Erreur de lecture du profil", error);
    next(error);
  }
});

router.put("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.auth.sub,
      { $set: { name: req.body?.name } },
      { new: true, runValidators: true },
    );

    if (!user) {
      console.warn(`[user] Mise à jour impossible : ${req.auth.sub}`);
      return res.status(404).json({ message: "Utilisateur inconnu" });
    }

    console.log(`[user] Nom mis à jour : ${user.id}`);
    res.json(user.toPublic());
  } catch (error) {
    console.error("[user] Erreur de mise à jour du profil", error);
    next(error);
  }
});

/**
 * Upload d'avatar utilisateur (format: JPEG, PNG, WEBP, max: 5Mo)
 */
router.put("/me/avatar", auth, avatarUpload.single("avatar"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier d'avatar fourni" });
    }

    const user = await User.findById(req.auth.sub);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur inconnu" });
    }

    // Supprimer l'ancien avatar du disque si existant
    if (user.avatarUrl) {
      const oldFilename = path.basename(user.avatarUrl);
      const oldFilePath = path.join(AVATARS_DIR, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch (unlinkErr) {
          console.warn("[user] Impossible de supprimer l'ancien avatar:", unlinkErr);
        }
      }
    }

    user.avatarUrl = `/api/users/avatar/${req.file.filename}`;
    await user.save();

    console.log(`[user] Avatar mis à jour pour ${user.id}: ${user.avatarUrl}`);
    res.json(user.toPublic());
  } catch (error) {
    console.error("[user] Erreur upload avatar:", error);
    next(error);
  }
});

/**
 * Obtenir l'avatar par son nom de fichier (route publique pour chargement des images)
 */
router.get("/avatar/:filename", (req, res) => {
  const filename = req.params.filename;

  // Sécurité anti path-traversal
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
    return res.status(400).json({ message: "Nom de fichier invalide" });
  }

  const filePath = path.join(AVATARS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Avatar introuvable" });
  }

  res.sendFile(filePath);
});

/**
 * Supprimer son avatar
 */
router.delete("/me/avatar", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur inconnu" });
    }

    if (user.avatarUrl) {
      const filename = path.basename(user.avatarUrl);
      const filePath = path.join(AVATARS_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn("[user] Impossible de supprimer le fichier avatar:", unlinkErr);
        }
      }
      user.avatarUrl = null;
      await user.save();
    }

    console.log(`[user] Avatar supprimé pour ${user.id}`);
    res.json(user.toPublic());
  } catch (error) {
    console.error("[user] Erreur suppression avatar:", error);
    next(error);
  }
});

export default router;
