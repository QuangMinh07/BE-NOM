const express = require("express");
const { getChatMessages, createChatRoom, sendMessage } = require("../controllers/chatController");

const router = express.Router();
router.get("/get-message/:roomId/", getChatMessages);
router.post("/create-room/:orderId", createChatRoom);
router.post("/send-message", sendMessage);
module.exports = router;
