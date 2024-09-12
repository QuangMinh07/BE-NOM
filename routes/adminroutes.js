const express = require("express");
const {
  registerAdmin,
  loginAdmin,
  getAllUser,
  approveSeller,
} = require("../controllers/admincontroller");
const { authenticateToken } = require("../middlewares/authMiddleware"); // Import the middleware
const router = express.Router();

// Route đăng ký Admin
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Protect the getAllUser route with authentication middleware
router.get("/get-all-user", authenticateToken, getAllUser);
router.post("/approve-seller", authenticateToken, approveSeller);

module.exports = router;
