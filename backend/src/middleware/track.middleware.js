import mongoose from "mongoose";
import { Share } from "../models/Share.js";

export async function canAccessTrack(userId, track) {
  if (!track) return false;
  if (track.visibility === "public") return true;
  if (!userId) return false;
  if (track.ownerId?.toString() === userId) return true;

  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  const trackId = track._id || track.id;
  const share = await Share.exists({ trackId, sharedWithId: userId });
  return !!share;
}

export function requireOwner(req, res, next) {
  if (req.track && req.track.ownerId.toString() !== req.auth.sub) {
    return res.status(403).json({ message: "Accès interdit : vous n'êtes pas le propriétaire" });
  }
  next();
}

