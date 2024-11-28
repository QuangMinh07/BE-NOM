const express = require("express");
const { searchFoodGroups, removeComboFromFoodGroup, addComboToFoodGroup, addFoodGroup, getFoodGroups, getFoodGroupByFoodIdAndStoreId, deleteFoodGroup, updateFoodGroupName } = require("../controllers/foodgroupcontroller");
// const passport = require('passport');
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-food-group/:storeId", authenticateToken, addFoodGroup);
router.get("/getfood-groups/:storeId", authenticateToken, getFoodGroups);
router.get("/get-foods-by-group/:storeId/:foodId", authenticateToken, getFoodGroupByFoodIdAndStoreId);
router.delete("/delete-foodgroup/:groupId", authenticateToken, deleteFoodGroup);
router.put("/update-foodgroup/:groupId", authenticateToken, updateFoodGroupName);
router.post("/add-combo/:groupId", authenticateToken, addComboToFoodGroup);
router.put("/remove-combo/:groupId", authenticateToken, removeComboFromFoodGroup);
router.get("/search", authenticateToken, searchFoodGroups);

module.exports = router;
