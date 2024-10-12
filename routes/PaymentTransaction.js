const express = require("express");
const router = express.Router();
const { createPaymentTransaction } = require("../controllers/PaymentTransactioncontroller"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");

// Route POST thêm nhân viên mới
router.post("/create-payment/:cartId/:storeId", authenticateToken, createPaymentTransaction);

module.exports = router;
