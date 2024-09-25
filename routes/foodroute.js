const express = require("express");
const { addFoodItem, getFoodById, getFoodsByStoreId, updateFoodAvailability, deleteFoodItem } = require("../controllers/foodcontrollers");
// const passport = require('passport');
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-food", authenticateToken, addFoodItem);
// Route lấy thông tin món ăn dựa trên foodId
router.get("/get-food/:foodId", authenticateToken, getFoodById);
router.put("/update-availability/:foodId", authenticateToken, updateFoodAvailability);
router.delete("/delete/:foodId", deleteFoodItem); // Route xóa món ăn

// Route lấy tất cả món ăn của cửa hàng dựa trên storeId
router.get("/get-foodstore/:storeId/foods", authenticateToken, getFoodsByStoreId);

module.exports = router;
