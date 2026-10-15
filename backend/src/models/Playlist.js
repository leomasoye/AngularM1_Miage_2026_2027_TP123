import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tracks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Track",
      },
    ],
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      index: true,
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Index pour lister les playlists d'un utilisateur ou les playlists publiques par date
schema.index({ ownerId: 1, createdAt: -1 });
schema.index({ visibility: 1, createdAt: -1 });

schema.methods.toPublic = function () {
  const owner = this.ownerId && typeof this.ownerId === "object" && this.ownerId.name
    ? {
        id: String(this.ownerId._id || this.ownerId.id),
        name: this.ownerId.name,
        avatarUrl: this.ownerId.avatarUrl || null,
      }
    : undefined;

  const formattedTracks = Array.isArray(this.tracks)
    ? this.tracks
        .filter(Boolean)
        .map((t) => {
          if (t && typeof t === "object" && (t._id || t.id)) {
            return {
              id: String(t._id || t.id),
              title: t.title,
              originalName: t.originalName,
              mimeType: t.mimeType,
              size: t.size,
              visibility: t.visibility,
              likes: Array.isArray(t.likes) ? t.likes.map((id) => String(id)) : [],
              ownerId: String(t.ownerId?._id || t.ownerId || ""),
              ownerName: t.ownerId?.name,
              createdAt: t.createdAt,
            };
          }
          return { id: String(t) };
        })
    : [];

  return {
    id: this.id,
    name: this.name,
    description: this.description || "",
    ownerId: String(this.ownerId?._id || this.ownerId),
    ownerName: owner?.name,
    ownerAvatarUrl: owner?.avatarUrl,
    visibility: this.visibility,
    tracksCount: Array.isArray(this.tracks) ? this.tracks.length : 0,
    tracks: formattedTracks,
    sharedWith: Array.isArray(this.sharedWith)
      ? this.sharedWith.map((id) => String(id?._id || id))
      : [],
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Playlist = mongoose.model("Playlist", schema);
