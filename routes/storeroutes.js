const express = require("express");
const { getStoreByUser } = require("../controllers/storecontrollers");
const { authenticateToken } = require("../middlewares/authMiddleware"); 
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/getStore/:userId", authenticateToken, getStoreByUser);

module.exports = router;
