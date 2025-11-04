const express = require("express");
const { auth } = require("../middlewares/auth");
const SearchController = require("../controllers/searchController");
const PublicationController = require("../controllers/publication");

const router = express.Router();

router.get("/users", auth, SearchController.searchUsers);
router.get("/posts", auth, PublicationController.searchPublications);

module.exports = router;
