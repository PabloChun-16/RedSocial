const express = require("express");
const { suggestTagsMiddleware, suggestTags } = require("../controllers/ai");
const { auth } = require("../middlewares/auth");

const router = express.Router();

router.post("/suggest-tags", auth, suggestTagsMiddleware, suggestTags);

module.exports = router;
