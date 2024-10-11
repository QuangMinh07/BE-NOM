const express = require("express");
const router = express.Router();
const { cancelOrder } = require("../controllers/OrderCancellationController"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");

// Route POST thêm nhân viên mới
router.post("/cancel/:userId/:orderId", authenticateToken, cancelOrder);

module.exports = router;
