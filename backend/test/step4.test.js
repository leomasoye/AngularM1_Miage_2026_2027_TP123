import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Share } from "../src/models/Share.js";
import { Track } from "../src/models/Track.js";
import { Friendship } from "../src/models/Friendship.js";
import { canAccessTrack } from "../src/middleware/track.middleware.js";

test("Share schema validation", () => {
  const trackId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const sharedWithId = new mongoose.Types.ObjectId();

  const share = new Share({
    trackId,
    ownerId,
    sharedWithId,
  });

  const pub = share.toPublic();
  assert.equal(pub.trackId, trackId.toString());
  assert.equal(pub.ownerId, ownerId.toString());
  assert.equal(pub.sharedWithId, sharedWithId.toString());
  assert.ok(pub.id);
});

test("canAccessTrack permissions", async () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const friendId = new mongoose.Types.ObjectId().toString();
  const strangerId = new mongoose.Types.ObjectId().toString();

  const publicTrack = {
    _id: new mongoose.Types.ObjectId(),
    ownerId: ownerId,
    visibility: "public",
  };

  const privateTrack = {
    _id: new mongoose.Types.ObjectId(),
    ownerId: ownerId,
    visibility: "private",
  };

  // 1. Owner a toujours accès
  assert.equal(await canAccessTrack(ownerId, publicTrack), true);
  assert.equal(await canAccessTrack(ownerId, privateTrack), true);

  // 2. Public track accessible par n'importe qui
  assert.equal(await canAccessTrack(strangerId, publicTrack), true);

  // 3. Private track inaccessible si pas de Share en base
  assert.equal(await canAccessTrack(friendId, privateTrack), false);
  assert.equal(await canAccessTrack(strangerId, privateTrack), false);
});

test("canAccessTrack with active share", async () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const friendId = new mongoose.Types.ObjectId().toString();
  const trackId = new mongoose.Types.ObjectId();

  const privateTrack = {
    _id: trackId,
    ownerId: ownerId,
    visibility: "private",
  };

  const originalExists = Share.exists;
  const originalReadyState = mongoose.connection.readyState;
  try {
    Share.exists = async ({ trackId: tId, sharedWithId: uId }) => {
      if (tId.toString() === trackId.toString() && uId === friendId) {
        return { _id: new mongoose.Types.ObjectId() };
      }
      return null;
    };

    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    assert.equal(await canAccessTrack(friendId, privateTrack), true);
    assert.equal(await canAccessTrack("stranger", privateTrack), false);
  } finally {
    Share.exists = originalExists;
    Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
  }
});

