const express = require("express");
const { addToCart, checkout, getCart, updateShippingInfo, removeFromCart, updateCartItem, getCartByStoreId, deleteCartById } = require("../controllers/cartcontroller");
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-to-cart/:userId", authenticateToken, addToCart);
router.post("/checkout/:userId/:storeId", authenticateToken, checkout);
router.get("/get-cart/:userId", authenticateToken, getCart);
router.put("/update/:userId/:storeId", authenticateToken, updateShippingInfo);
router.delete("/remove/:userId/:cartId/:foodId", authenticateToken, removeFromCart); // API xóa món ăn
router.get("/getcart/:userId/:storeId", authenticateToken, getCartByStoreId);
router.delete("/delete-cart/:cartId", authenticateToken, deleteCartById); // API xóa món ăn
router.put("/update-item/:userId/:cartId/:foodId", authenticateToken, updateCartItem);

module.exports = router;
