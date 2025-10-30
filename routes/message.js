const express = require("express");
const router = express.Router();
const MessageController = require("../controllers/message");
const { auth } = require("../middlewares/auth");

router.get("/summary", auth, MessageController.getSummary);
router.get("/threads", auth, MessageController.listThreads);
router.get("/with/:userId", auth, MessageController.getConversationWithUser);
router.get("/conversation/:conversationId", auth, MessageController.getConversationById);
router.post("/with/:userId", auth, MessageController.sendMessageToUser);
router.post(
  "/conversation/:conversationId/read",
  auth,
  MessageController.markConversationAsRead
);

module.exports = router;
