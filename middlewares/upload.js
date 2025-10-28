const fs = require("fs");
const path = require("path");
const multer = require("multer");

const AVATAR_FOLDER = path.join(__dirname, "..", "public", "uploads", "avatars");
const POST_FOLDER = path.join(__dirname, "..", "public", "uploads", "posts");
const STORY_FOLDER = path.join(__dirname, "..", "public", "uploads", "stories");

fs.mkdirSync(AVATAR_FOLDER, { recursive: true });
fs.mkdirSync(POST_FOLDER, { recursive: true });
fs.mkdirSync(STORY_FOLDER, { recursive: true });

const createStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, folder);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      const safeExt = ext.toLowerCase();
      const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const userId = req.user?.id || "anonymous";
      cb(null, `${userId}-${uniqueId}${safeExt}`);
    }
  });

const allowedMime = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif"
]);

const makeFileFilter = (fieldName) => (req, file, cb) => {
  if (allowedMime.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", fieldName));
  }
};

const avatarUpload = multer({
  storage: createStorage(AVATAR_FOLDER),
  fileFilter: makeFileFilter("avatar"),
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB
  }
});

const postUpload = multer({
  storage: createStorage(POST_FOLDER),
  fileFilter: makeFileFilter("media"),
  limits: {
    fileSize: 12 * 1024 * 1024 // 12MB
  }
});

const storyUpload = multer({
  storage: createStorage(STORY_FOLDER),
  fileFilter: makeFileFilter("media"),
  limits: {
    fileSize: 12 * 1024 * 1024 // 12MB
  }
});

module.exports = {
  avatarUpload,
  postUpload,
  storyUpload
};
