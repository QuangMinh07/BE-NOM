const express = require("express");
const { addFoodGroup, getFoodGroups, getFoodGroupByFoodIdAndStoreId } = require("../controllers/foodgroupcontroller");
// const passport = require('passport');
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-food-group/:storeId", authenticateToken, addFoodGroup);
router.get("/getfood-groups/:storeId", authenticateToken, getFoodGroups);
router.get("/get-foods-by-group/:storeId/:foodId", authenticateToken, getFoodGroupByFoodIdAndStoreId);

module.exports = router;
