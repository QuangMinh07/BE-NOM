const express = require("express");
const router = express.Router();
const { cancelOrder, getCancelledOrders } = require("../controllers/OrderCancellationController"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");

// Route POST thêm nhân viên mới
router.post("/cancel/:userId/:orderId", authenticateToken, cancelOrder);
router.get("/cancelled-orders", authenticateToken, getCancelledOrders);

module.exports = router;
