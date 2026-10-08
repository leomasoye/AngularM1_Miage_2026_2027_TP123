import express from "express";
import { User } from "../models/User.js";
import { auth } from "../middleware/auth.middleware.js";

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

export default router;
