const express = require("express");
const router = express.Router();
const FollowController = require("../controllers/follow");
const { auth } = require("../middlewares/auth");

router.post("/:userId", auth, FollowController.followUser);
router.delete("/:userId", auth, FollowController.unfollowUser);

module.exports = router;
