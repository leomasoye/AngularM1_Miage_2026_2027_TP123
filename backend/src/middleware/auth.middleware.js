import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

export function token(user) {
  console.log(`[auth] Création d'un token pour l'utilisateur ${user.id}`);
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, {
    expiresIn: "2h",
  });
}

export function auth(req, res, next) {
  let raw = req.headers.authorization;
  if (!raw && req.query?.token) {
    raw = `Bearer ${req.query.token}`;
  }

  if (!raw?.startsWith("Bearer ")) {
    console.warn(`[auth] Authorization absente pour ${req.method} ${req.path}`);
    return res.status(401).json({ message: "Authentification requise" });
  }

  try {
    req.auth = jwt.verify(raw.slice(7), SECRET);
    console.log(`[auth] Token accepté pour ${req.auth.sub}`);
    next();
  } catch (error) {
    console.error("[auth] Token invalide ou expiré", error);
    return res.status(401).json({ message: "Jeton invalide ou expiré" });
  }
}

export function optionalAuth(req, res, next) {
  let raw = req.headers.authorization;
  if (!raw && req.query?.token) {
    raw = `Bearer ${req.query.token}`;
  }

  if (!raw?.startsWith("Bearer ")) {
    req.auth = null;
    return next();
  }

  try {
    req.auth = jwt.verify(raw.slice(7), SECRET);
    next();
  } catch {
    req.auth = null;
    next();
  }
}

