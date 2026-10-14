import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const AVATARS_DIR = path.resolve("data/avatars");

try {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des avatars", error);
}

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, AVATARS_DIR);
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const filename = `avatar-${crypto.randomUUID()}${ext}`;
    callback(null, filename);
  },
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      return callback(null, true);
    }
    const error = new Error("Format d'image non accepté (formats valides: JPEG, PNG, WEBP)");
    return callback(error);
  },
});

export { AVATARS_DIR };
