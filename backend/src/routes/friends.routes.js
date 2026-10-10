import express from "express";
import rateLimit from "express-rate-limit";
import { Friendship } from "../models/Friendship.js";
import { User } from "../models/User.js";
import { auth } from "../middleware/auth.middleware.js";

const router = express.Router();

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Trop de demandes d'amitié, veuillez ralentir." },
});

// Récupérer toutes les amitiés impliquant l'utilisateur
router.get("/", auth, async (req, res, next) => {
  try {
    const userId = req.auth.sub;
    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { addresseeId: userId }]
    }).populate("requesterId", "name").populate("addresseeId", "name");

    const mapped = friendships.map(f => {
      const isRequester = f.requesterId._id.toString() === userId;
      return {
        id: String(f._id),
        status: f.status,
        friendId: isRequester ? String(f.addresseeId._id) : String(f.requesterId._id),
        friendName: isRequester ? f.addresseeId.name : f.requesterId.name,
        isIncoming: !isRequester,
        createdAt: f.createdAt
      };
    });

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

// Envoyer une demande d'amitié
router.post("/", auth, requestLimiter, async (req, res, next) => {
  try {
    const requesterId = req.auth.sub;
    const { addresseeId } = req.body;

    if (!addresseeId) {
      return res.status(400).json({ message: "ID de l'ami requis" });
    }

    if (requesterId === addresseeId) {
      return res.status(400).json({ message: "Vous ne pouvez pas vous ajouter vous-même." });
    }

    const targetUser = await User.findById(addresseeId);
    if (!targetUser) {
      return res.status(404).json({ message: "Utilisateur inconnu" });
    }

    // Vérifier amitié croisée B -> A
    const inverseFriendship = await Friendship.findOne({
      requesterId: addresseeId,
      addresseeId: requesterId
    });

    if (inverseFriendship) {
      if (inverseFriendship.status === 'pending') {
        // Acceptation automatique de la demande si on fait une demande en retour
        inverseFriendship.status = 'accepted';
        await inverseFriendship.save();
        return res.json(inverseFriendship.toPublic());
      } else if (inverseFriendship.status === 'accepted') {
        return res.status(400).json({ message: "Vous êtes déjà amis." });
      }
      // Si rejected, B avait rejeté A, on laisse passer pour créer A -> B
    }

    let friendship = await Friendship.findOne({
      requesterId,
      addresseeId
    });

    if (friendship) {
      if (friendship.status === 'pending') {
        return res.status(400).json({ message: "Demande déjà envoyée." });
      } else if (friendship.status === 'accepted') {
        return res.status(400).json({ message: "Vous êtes déjà amis." });
      } else {
        // Si B avait rejeté A avant, A peut refaire une demande
        friendship.status = 'pending';
        await friendship.save();
        return res.json(friendship.toPublic());
      }
    }

    friendship = await Friendship.create({
      requesterId,
      addresseeId,
      status: 'pending'
    });

    res.status(201).json(friendship.toPublic());
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Demande déjà existante." });
    }
    next(error);
  }
});

// Accepter / Rejeter une demande
router.patch("/:id/status", auth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const friendship = await Friendship.findOne({
      _id: req.params.id,
      addresseeId: req.auth.sub
    });

    if (!friendship) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    friendship.status = status;
    await friendship.save();

    res.json(friendship.toPublic());
  } catch (error) {
    next(error);
  }
});

// Supprimer un ami ou annuler une demande
router.delete("/:id", auth, async (req, res, next) => {
  try {
    const friendship = await Friendship.findOne({
      _id: req.params.id,
      $or: [{ requesterId: req.auth.sub }, { addresseeId: req.auth.sub }]
    });

    if (!friendship) {
      return res.status(404).json({ message: "Amitié introuvable" });
    }

    await Friendship.findByIdAndDelete(friendship._id);
    
    // TODO: cascade suppression Share Etape 4
    // await mongoose.model('Share').deleteMany({
    //   $or: [
    //     { ownerId: friendship.requesterId, sharedWithId: friendship.addresseeId },
    //     { ownerId: friendship.addresseeId, sharedWithId: friendship.requesterId }
    //   ]
    // });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
