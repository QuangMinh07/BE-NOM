const express = require("express");
const router = express.Router();
const { deleteStaff, addStaff, getStaff, updateStaff } = require("../controllers/staffcontrollers"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");

// Route POST thêm nhân viên mới
router.post("/add-staff", authenticateToken, addStaff);
router.get("/get-staff", authenticateToken, getStaff);
router.put("/update-staff/:staffId", authenticateToken, updateStaff);
router.delete("/delete-staff/:staffId", authenticateToken, deleteStaff);

module.exports = router;
