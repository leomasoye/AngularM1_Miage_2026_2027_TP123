---
name: express-api-patterns
description: >
  Patterns pour etendre l API Express du backend (Node.js/Mongoose).
  Couvre l ajout de nouveaux modeles, routes RESTful, middleware,
  et bonnes pratiques de securite/validation pour le TP4.
---

# Express API Patterns - TP MIAGE Backend

## Ajouter un nouveau modele Mongoose

```javascript
// src/models/Friendship.js
import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    addresseeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true },
  },
  { timestamps: true },
);

// Index compose pour eviter les doublons
schema.index({ requesterId: 1, addresseeId: 1 }, { unique: true });

schema.methods.toPublic = function () {
  return { id: this.id, requesterId: String(this.requesterId), addresseeId: String(this.addresseeId), status: this.status, createdAt: this.createdAt };
};

export const Friendship = mongoose.model("Friendship", schema);
```

## Pattern route - GET liste des amis

```javascript
app.get("/api/friends", auth, async (req, res, next) => {
  try {
    const friendships = await Friendship.find({
      status: "accepted",
    }).where("requesterId eq req.auth.sub OR addresseeId eq req.auth.sub").lean();
    res.json(friendships.map(f => f.toPublic()));
  } catch (error) { next(error); }
});
```

## Pattern route - POST demande d ami

```javascript
app.post("/api/friends/request/:userId", auth, async (req, res, next) => {
  try {
    if (req.params.userId === req.auth.sub) {
      return res.status(400).json({ message: "Action impossible sur soi-meme" });
    }
    const friendship = await Friendship.create({
      requesterId: req.auth.sub,
      addresseeId: req.params.userId,
    });
    res.status(201).json(friendship.toPublic());
  } catch (error) { next(error); }
});
```

## Pattern route - PATCH accepter/refuser

```javascript
app.patch("/api/friends/request/:id", auth, async (req, res, next) => {
  try {
    const status = req.body.action === "accept" ? "accepted" : "rejected";
    const friendship = await Friendship.findOneAndUpdate(
      { _id: req.params.id, addresseeId: req.auth.sub, status: "pending" },
      { status },
      { new: true }
    );
    if (!friendship) return res.status(404).json({ message: "Demande introuvable" });
    res.json(friendship.toPublic());
  } catch (error) { next(error); }
});
```

## Pattern Like sur une piste

```javascript
// POST like - addToSet evite les doublons nativement
app.post("/api/tracks/:id/like", auth, async (req, res, next) => {
  try {
    const track = await Track.findByIdAndUpdate(
      req.params.id,
      { addToSet likes req.auth.sub },
      { new: true }
    );
    if (!track) return res.status(404).json({ message: "Piste inconnue" });
    res.json({ likesCount: track.likes.length, liked: true });
  } catch (error) { next(error); }
});

// DELETE unlike - pull supprime la valeur du tableau
app.delete("/api/tracks/:id/like", auth, async (req, res, next) => {
  try {
    const track = await Track.findByIdAndUpdate(
      req.params.id,
      { pull likes req.auth.sub },
      { new: true }
    );
    if (!track) return res.status(404).json({ message: "Piste inconnue" });
    res.json({ likesCount: track.likes.length, liked: false });
  } catch (error) { next(error); }
});
```

## Validation ObjectId helper

```javascript
function validateObjectId(id, res) {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    res.status(400).json({ message: "Identifiant invalide" });
    return false;
  }
  return true;
}
```

## Regles API imperatifs
- Toutes les routes protegees passent par le middleware auth
- Toujours utiliser next(error) pour propager les erreurs
- Pas de console.log avec des donnees sensibles (tokens, mots de passe)
- Renvoyer des messages d erreur generiques a l utilisateur
- Limiter les champs exposes avec toPublic() ou .select()
- Verifier la propriete des ressources avant toute modification
- Utiliser addToSet et pull pour les tableaux (pas push/splice natif)
