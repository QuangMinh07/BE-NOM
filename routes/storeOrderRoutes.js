const express = require("express");
const { updatePaymentMethod, createOrderFromCart, getOrderDetails } = require("../controllers/storeOrderController");
const { authenticateToken } = require("../middlewares/authMiddleware"); // Import the middleware
const router = express.Router();

// Route đăng ký Admin
router.post("/update-payment-method", authenticateToken, updatePaymentMethod);
router.post("/create/:cartId", authenticateToken, createOrderFromCart);
router.get("/details/:orderId", authenticateToken, getOrderDetails);

module.exports = router;
