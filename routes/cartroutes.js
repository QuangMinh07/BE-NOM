const express = require("express");
const { addToCart, checkout, getCart, updateShippingInfo, removeFromCart } = require("../controllers/cartcontroller");
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-to-cart/:userId", authenticateToken, addToCart);
router.post("/checkout/:userId", authenticateToken, checkout);
router.get("/get-cart/:userId", authenticateToken, getCart);
router.put("/update/:userId", authenticateToken, updateShippingInfo);
router.delete("/remove/:userId/:foodId", authenticateToken, removeFromCart); // API xóa món ăn

module.exports = router;
