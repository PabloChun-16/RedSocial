const express = require("express");
const multer = require("multer");
const router = express.Router();
const storyController = require("../controllers/story");
const { auth } = require("../middlewares/auth");
const { storyUpload } = require("../middlewares/upload");

const storyMediaMiddleware = (req, res, next) => {
  storyUpload.single("media")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "La imagen supera el tamaño máximo permitido (12MB)"
            : "El archivo proporcionado no es una imagen válida";
        return res.status(400).json({ status: "error", message });
      }
      return res.status(500).json({
        status: "error",
        message: "No se pudo procesar la imagen",
        error: err.message
      });
    }
    next();
  });
};

router.get("/", auth, storyController.listStories);
router.get("/me", auth, storyController.listSelfStories);
router.post("/", auth, storyMediaMiddleware, storyController.createStory);
router.delete("/:id", auth, storyController.deleteStory);

module.exports = router;
