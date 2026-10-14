import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/User.js";
import { avatarUpload } from "../src/middleware/avatar-upload.middleware.js";

test("User schema avatarUrl property and toPublic()", () => {
  const user = new User({
    name: "John Doe",
    email: "john@example.com",
    avatarUrl: "/api/users/avatar/avatar-123.png",
  });

  const publicData = user.toPublic();
  assert.equal(publicData.name, "John Doe");
  assert.equal(publicData.avatarUrl, "/api/users/avatar/avatar-123.png");

  const defaultUser = new User({
    name: "Jane Doe",
    email: "jane@example.com",
  });
  assert.equal(defaultUser.toPublic().avatarUrl, null);
});

test("avatarUpload filter accepts jpeg, png, webp and rejects other types", () => {
  const filter = avatarUpload.fileFilter;
  assert.ok(typeof filter === "function");

  let accepted = false;
  filter(null, { mimetype: "image/png" }, (err, result) => {
    assert.equal(err, null);
    accepted = result;
  });
  assert.equal(accepted, true);

  filter(null, { mimetype: "image/jpeg" }, (err, result) => {
    assert.equal(err, null);
    accepted = result;
  });
  assert.equal(accepted, true);

  filter(null, { mimetype: "image/webp" }, (err, result) => {
    assert.equal(err, null);
    accepted = result;
  });
  assert.equal(accepted, true);

  filter(null, { mimetype: "text/plain" }, (err) => {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("Format d'image non accepté"));
  });
});
