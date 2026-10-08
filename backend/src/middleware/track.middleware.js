export function canAccessTrack(userId, track) {
  if (track.ownerId.toString() === userId) return true;
  if (track.visibility === 'public') return true;
  // TODO: étape 4 - gestion des partages
  return false;
}

export function requireOwner(req, res, next) {
  // on a besoin de charger la piste avant, ce sera fait dans les routes
  // ou on peut juste vérifier si req.track.ownerId === req.auth.sub
  if (req.track && req.track.ownerId.toString() !== req.auth.sub) {
    return res.status(403).json({ message: "Accès interdit : vous n'êtes pas le propriétaire" });
  }
  next();
}
