const express = require("express");
const { addFoodItem } = require("../controllers/foodcontrollers");
// const passport = require('passport');
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-food", authenticateToken, addFoodItem);

module.exports = router;
