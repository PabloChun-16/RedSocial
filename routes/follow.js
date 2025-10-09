const express = require('express');
const router = express.Router();
const FollowController = require("../controllers/follow");

//definiar rutas

router.get("/prueba-follow", FollowController.pruebaFollow);

//exportar modulo

module.exports = router;
