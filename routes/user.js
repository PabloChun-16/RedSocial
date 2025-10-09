const express = require("express");
const multer = require("multer");
const router = express.Router();
const UserController = require("../controllers/user");
const { auth } = require("../middlewares/auth");
const { avatarUpload } = require("../middlewares/upload");

// Rutas de prueba
router.get("/prueba-usuario", UserController.pruebaUser);
router.get("/all", UserController.listUsers);


// Rutas reales de usuario
router.post("/register", UserController.register);
router.post("/login", UserController.login);
router.get("/profile", auth, UserController.getProfile);

const avatarMiddleware = (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "La imagen supera el tamaño máximo permitido (3MB)"
            : "El archivo proporcionado no es una imagen válida";
        return res.status(400).json({ status: "error", message });
      }
      return res.status(500).json({
        status: "error",
        message: "No se pudo procesar la imagen de perfil",
        error: err.message
      });
    }
    next();
  });
};

router.put("/profile", auth, avatarMiddleware, UserController.updateProfile);

module.exports = router;
