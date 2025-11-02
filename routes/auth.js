const express = require("express");
const AuthController = require("../controllers/authController");

const router = express.Router();

router.get("/config", AuthController.getAuthConfig);
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google", AuthController.google);

module.exports = router;
