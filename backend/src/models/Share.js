import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sharedWithId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Unicité : une piste ne peut être partagée qu'une fois avec le même utilisateur
schema.index({ trackId: 1, sharedWithId: 1 }, { unique: true });

schema.methods.toPublic = function () {
  return {
    id: this.id,
    trackId: String(this.trackId),
    ownerId: String(this.ownerId),
    sharedWithId: String(this.sharedWithId),
    createdAt: this.createdAt,
  };
};

export const Share = mongoose.model("Share", schema);
