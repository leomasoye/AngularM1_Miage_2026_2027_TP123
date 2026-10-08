import express from "express";
import { User } from "../models/User.js";
import { token } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    console.log(`[auth] Tentative d'inscription pour ${email || "email absent"}`);

    if (!name || !email || !password || password.length < 8) {
      console.warn("[auth] Inscription refusée : données invalides ou incomplètes");
      return res.status(400).json({
        message: "Nom, email et mot de passe de 8 caractères requis",
      });
    }

    if (await User.exists({ email: String(email).toLowerCase() })) {
      console.warn(`[auth] Email déjà utilisé : ${email}`);
      return res.status(409).json({ message: "Email déjà utilisé" });
    }

    const user = await User.create({ name, email, password });
    console.log(`[auth] Utilisateur créé : ${user.id}`);
    res.status(201).json({ token: token(user), user: user.toPublic() });
  } catch (error) {
    console.error("[auth] Erreur pendant l'inscription", error);
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").toLowerCase();
    console.log(`[auth] Tentative de connexion pour ${email || "email absent"}`);

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await user.verifyPassword(req.body?.password || ""))) {
      console.warn(`[auth] Identifiants incorrects pour ${email}`);
      return res.status(401).json({ message: "Identifiants incorrects" });
    }

    console.log(`[auth] Connexion réussie : ${user.id}`);
    res.json({ token: token(user), user: user.toPublic() });
  } catch (error) {
    console.error("[auth] Erreur pendant la connexion", error);
    next(error);
  }
});

export default router;
