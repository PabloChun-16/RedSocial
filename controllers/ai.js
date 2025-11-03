const multer = require("multer");
const {
  detectLabelsFromBytes,
  localTranslateLabels
} = require("../utils/ai");

const MAX_FILE_SIZE_MB = Number.parseInt(process.env.AI_SUGGEST_MAX_MB || "10", 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024
  }
});

const suggestTagsMiddleware = upload.single("image");

const suggestTags = async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      ok: false,
      status: "error",
      message: "Debes adjuntar una imagen para obtener sugerencias"
    });
  }

  try {
    const englishLabels = await detectLabelsFromBytes(req.file.buffer);
    const spanishLabels = localTranslateLabels(englishLabels);
    const uniqueLabels = Array.from(new Set(spanishLabels));
    return res.status(200).json({
      ok: true,
      suggestions: uniqueLabels
    });
  } catch (error) {
    console.error("[AI] ERROR suggestTags:", error);
    return res.status(500).json({
      ok: false,
      error: "No se pudieron obtener sugerencias locales",
      detail: String(error)
    });
  }
};

module.exports = {
  suggestTagsMiddleware,
  suggestTags
};
