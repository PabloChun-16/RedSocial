const multer = require("multer");
const memoryStorage = multer.memoryStorage();

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

const createUpload = ({ fieldName, fileSizeLimit }) =>
  multer({
    storage: memoryStorage,
    fileFilter: makeFileFilter(fieldName),
    limits: {
      fileSize: fileSizeLimit
    }
  });

const avatarUpload = createUpload({
  fieldName: "avatar",
  fileSizeLimit: 3 * 1024 * 1024 // 3MB
});

const postUpload = createUpload({
  fieldName: "media",
  fileSizeLimit: 12 * 1024 * 1024 // 12MB
});

const storyUpload = createUpload({
  fieldName: "media",
  fileSizeLimit: 12 * 1024 * 1024 // 12MB
});

module.exports = {
  avatarUpload,
  postUpload,
  storyUpload
};
