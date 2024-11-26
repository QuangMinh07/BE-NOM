const express = require("express");
const { getShipperInfo, getDeliveredOrdersByShipper } = require("../controllers/shippercontroller");
const { authenticateToken } = require("../middlewares/authMiddleware");
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/getshipper/:userId", authenticateToken, getShipperInfo);
router.get("/delivered-orders/:shipperId", authenticateToken, getDeliveredOrdersByShipper);

module.exports = router;
