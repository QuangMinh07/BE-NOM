const express = require("express");
const { addToCart, checkout } = require("../controllers/cartcontroller");
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-to-cart/:userId", authenticateToken, addToCart);
router.post("/checkout/:userId", authenticateToken, checkout);

module.exports = router;
