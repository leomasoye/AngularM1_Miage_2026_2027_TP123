import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const UPLOADS = path.resolve("data/uploads");

try {
  fs.mkdirSync(UPLOADS, { recursive: true });
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des uploads", error);
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const allowed = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
]);

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, UPLOADS);
  },
  filename: (_request, file, callback) => {
    const filename = crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
    callback(null, filename);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    if (allowed.has(file.mimetype)) {
      return callback(null, true);
    }
    const error = new Error("Format audio non accepté");
    return callback(error);
  },
});

export { UPLOADS };
