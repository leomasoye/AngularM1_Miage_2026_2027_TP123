import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Playlist } from "../src/models/Playlist.js";
import { canAccessPlaylist } from "../src/routes/playlist.routes.js";

test("Playlist model validation and toPublic()", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const trackId1 = new mongoose.Types.ObjectId();
  const trackId2 = new mongoose.Types.ObjectId();

  const playlist = new Playlist({
    name: "Rock Classics",
    description: "Mes morceaux favoris pour coder",
    ownerId,
    tracks: [trackId1, trackId2],
    visibility: "public",
  });

  const pub = playlist.toPublic();
  assert.equal(pub.name, "Rock Classics");
  assert.equal(pub.description, "Mes morceaux favoris pour coder");
  assert.equal(pub.ownerId, ownerId.toString());
  assert.equal(pub.visibility, "public");
  assert.equal(pub.tracksCount, 2);
  assert.equal(pub.tracks.length, 2);
  assert.ok(pub.id);
});

test("Playlist default values", () => {
  const ownerId = new mongoose.Types.ObjectId();
  const playlist = new Playlist({
    name: "Focus Vibes",
    ownerId,
  });

  assert.equal(playlist.visibility, "public");
  assert.equal(playlist.description, "");
  assert.deepEqual(playlist.tracks, []);

  const pub = playlist.toPublic();
  assert.equal(pub.tracksCount, 0);
  assert.equal(pub.description, "");
});

test("canAccessPlaylist permissions", async () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const strangerId = new mongoose.Types.ObjectId().toString();
  const sharedUserId = new mongoose.Types.ObjectId().toString();

  const publicPlaylist = {
    _id: new mongoose.Types.ObjectId(),
    ownerId,
    visibility: "public",
    sharedWith: [],
  };

  const privatePlaylist = {
    _id: new mongoose.Types.ObjectId(),
    ownerId,
    visibility: "private",
    sharedWith: [sharedUserId],
  };

  // 1. Owner a toujours accès
  assert.equal(await canAccessPlaylist(ownerId, publicPlaylist), true);
  assert.equal(await canAccessPlaylist(ownerId, privatePlaylist), true);

  // 2. Playlist publique accessible par n'importe qui (même non connecté)
  assert.equal(await canAccessPlaylist(strangerId, publicPlaylist), true);
  assert.equal(await canAccessPlaylist(null, publicPlaylist), true);

  // 3. Playlist privée accessible si l'utilisateur est dans sharedWith
  assert.equal(await canAccessPlaylist(sharedUserId, privatePlaylist), true);

  // 4. Playlist privée inaccessible pour un inconnu non ami
  assert.equal(await canAccessPlaylist(strangerId, privatePlaylist), false);
  assert.equal(await canAccessPlaylist(null, privatePlaylist), false);
});
