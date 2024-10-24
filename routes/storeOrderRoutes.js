const express = require("express");
const { updatePaymentMethod, createOrderFromCart, getOrderDetails, getAllOrders, updateOrderStatus, getOrdersByStore, getDeliveredOrdersAndRevenue } = require("../controllers/storeOrderController");
const { authenticateToken } = require("../middlewares/authMiddleware"); // Import the middleware
const router = express.Router();

// Route đăng ký Admin
router.post("/update-payment-method", authenticateToken, updatePaymentMethod);
router.post("/create/:cartId", authenticateToken, createOrderFromCart);
router.get("/details/:orderId", authenticateToken, getOrderDetails);
router.get("/get-all-orders", authenticateToken, getAllOrders);
router.put("/update-status/:storeId/:userId", authenticateToken, updateOrderStatus);
router.get("/get-orders/:storeId", authenticateToken, getOrdersByStore);
router.get("/delivered-revenue/:storeId", getDeliveredOrdersAndRevenue);

module.exports = router;
