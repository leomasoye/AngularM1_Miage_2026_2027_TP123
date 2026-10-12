import express from "express";
import { Friendship } from "../models/Friendship.js";
import { Share } from "../models/Share.js";
import { Track } from "../models/Track.js";
import { auth } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * GET /api/activity
 * Récupère le flux des nouveautés des amis :
 * - Pistes publiques uploadées par des amis
 * - Pistes privées partagées explicitement avec l'utilisateur par des amis
 * Pagination par curseur de date (?before=ISOString&limit=20)
 */
router.get("/", auth, async (req, res, next) => {
  try {
    const userId = req.auth.sub;

    // 1. Trouver les amis acceptés
    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { addresseeId: userId }],
      status: "accepted",
    });

    const friendIds = friendships.map((f) =>
      f.requesterId.toString() === userId ? f.addresseeId : f.requesterId
    );

    if (friendIds.length === 0) {
      return res.json({ items: [], hasMore: false, nextCursor: null });
    }

    // 2. Trouver les pistes partagées avec l'utilisateur connecté
    const shares = await Share.find({ sharedWithId: userId });
    const sharedTrackIds = shares.map((s) => s.trackId);
    const sharedTrackIdSet = new Set(sharedTrackIds.map((id) => id.toString()));

    // 3. Critères d'accès : publiques des amis OU partagées par des amis
    const filter = {
      $or: [
        { ownerId: { $in: friendIds }, visibility: "public" },
        { _id: { $in: sharedTrackIds }, ownerId: { $in: friendIds } },
      ],
    };

    if (req.query.before) {
      const beforeDate = new Date(req.query.before);
      if (!isNaN(beforeDate.getTime())) {
        filter.createdAt = { $lt: beforeDate };
      }
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const tracks = await Track.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("ownerId", "name")
      .select("-storedName");

    const hasMore = tracks.length > limit;
    const itemsSlice = hasMore ? tracks.slice(0, limit) : tracks;

    const items = itemsSlice.map((t) => ({
      id: String(t._id),
      title: t.title,
      originalName: t.originalName,
      mimeType: t.mimeType,
      size: t.size,
      visibility: t.visibility,
      isShared: sharedTrackIdSet.has(t._id.toString()),
      ownerId: String(t.ownerId?._id || t.ownerId),
      ownerName: t.ownerId?.name || "Ami",
      likes: t.likes ? t.likes.map((l) => String(l)) : [],
      createdAt: t.createdAt,
    }));

    const nextCursor = items.length > 0 ? items[items.length - 1].createdAt : null;

    res.json({
      items,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
