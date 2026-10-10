import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addresseeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Unicité: Un utilisateur ne peut faire qu'une demande vers un autre utilisateur spécifique
schema.index({ requesterId: 1, addresseeId: 1 }, { unique: true });

// Empêcher l'auto-amitié (Validation au niveau de Mongoose)
schema.pre("validate", function (next) {
  if (this.requesterId && this.addresseeId && this.requesterId.toString() === this.addresseeId.toString()) {
    return next(new Error("Vous ne pouvez pas vous ajouter vous-même en ami."));
  }
  next();
});

schema.methods.toPublic = function () {
  return {
    id: this.id,
    requesterId: String(this.requesterId),
    addresseeId: String(this.addresseeId),
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Friendship = mongoose.model("Friendship", schema);
