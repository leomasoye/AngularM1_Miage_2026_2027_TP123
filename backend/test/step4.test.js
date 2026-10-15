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

  // 2. Public track accessible par n'importe qui (même sans token/userId)
  assert.equal(await canAccessTrack(strangerId, publicTrack), true);
  assert.equal(await canAccessTrack(null, publicTrack), true);

  // 3. Private track inaccessible si pas de Share en base ou sans userId
  assert.equal(await canAccessTrack(friendId, privateTrack), false);
  assert.equal(await canAccessTrack(strangerId, privateTrack), false);
  assert.equal(await canAccessTrack(null, privateTrack), false);
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

test("Friendship schema validation and self-friendship rejection", async () => {
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();

  const validFriendship = new Friendship({
    requesterId: userA,
    addresseeId: userB,
  });
  await validFriendship.validate();
  assert.equal(validFriendship.status, "pending");

  const selfFriendship = new Friendship({
    requesterId: userA,
    addresseeId: userA,
  });

  await assert.rejects(
    async () => {
      await selfFriendship.validate();
    },
    /Vous ne pouvez pas vous ajouter vous-même/
  );
});

test("Track model likes and toPublic output", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const track = new Track({
    ownerId,
    title: "In the End",
    originalName: "in_the_end.mp3",
    storedName: "secret_file.mp3",
    mimeType: "audio/mpeg",
    size: 1024,
    visibility: "public",
    likes: [userId],
  });

  const pub = track.toPublic();
  assert.equal(pub.title, "In the End");
  assert.equal(pub.visibility, "public");
  assert.equal(pub.likes.length, 1);
  assert.equal(pub.likes[0], userId.toString());
  assert.equal(pub.storedName, undefined); // Never expose storedName
});

