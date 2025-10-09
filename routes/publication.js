const express = require("express");
const multer = require("multer");
const router = express.Router();
const publicationController = require("../controllers/publication");
const { auth } = require("../middlewares/auth");
const { postUpload } = require("../middlewares/upload");

const postMediaMiddleware = (req, res, next) => {
  postUpload.single("media")(req, res, (err) => {
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

router.get("/prueba-publication", publicationController.pruebaPublication);
router.post("/", auth, postMediaMiddleware, publicationController.createPublication);
router.get("/feed", auth, publicationController.listFeed);
router.get("/user/:userId", auth, publicationController.listByUser);
router.get("/:id", auth, publicationController.getPublication);

module.exports = router;
