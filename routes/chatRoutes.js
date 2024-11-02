const express = require("express");
const { getChatMessages, createChatRoom, sendMessage, getChatRooms } = require("../controllers/chatController");

const router = express.Router();
router.get("/get-message/:roomId/", getChatMessages);
router.post("/create-room/:orderId", createChatRoom);
router.post("/send-message", sendMessage);
router.get("/chat-room/:userId/:shipperId", getChatRooms); // Route mới để lấy danh sách phòng chat

module.exports = router;
