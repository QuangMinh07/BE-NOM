const express = require("express");
const { authenticateToken } = require("../middlewares/authMiddleware");
const {
  getUserPersonalInfo,
  updateUserPersonalInfo,
} = require("../controllers/userPersonalcontrollers");

const router = express.Router();

// Route để lấy thông tin cá nhân (yêu cầu xác thực token)
router.get("/personal-info", authenticateToken, getUserPersonalInfo);
router.put("/update-personal-info", authenticateToken, updateUserPersonalInfo);

module.exports = router;
