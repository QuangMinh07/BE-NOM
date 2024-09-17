const express = require("express");
const router = express.Router();
const { addStaff } = require("../controllers/staffcontrollers"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");

// Route POST thêm nhân viên mới
router.post("/add-staff", authenticateToken, addStaff);

module.exports = router;
