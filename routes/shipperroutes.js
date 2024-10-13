const express = require("express");
const { getShipperInfo } = require("../controllers/shippercontroller");
const { authenticateToken } = require("../middlewares/authMiddleware");
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/getshipper/:userId", authenticateToken, getShipperInfo);

module.exports = router;
