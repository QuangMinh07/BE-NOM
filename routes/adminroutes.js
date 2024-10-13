const express = require("express");
const { registerAdmin, loginAdmin, getAllUser, approveSeller, rejectSeller, getStoreCount, getAllStores, approveShipper, rejectShipper } = require("../controllers/admincontroller");
const { authenticateToken } = require("../middlewares/authMiddleware"); // Import the middleware
const router = express.Router();

// Route đăng ký Admin
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

// Protect the getAllUser route with authentication middleware
router.get("/get-all-user", authenticateToken, getAllUser);
router.post("/approve-seller", authenticateToken, approveSeller);
router.post("/reject-seller", authenticateToken, rejectSeller);
router.post("/getStoreCount", authenticateToken, getStoreCount);
router.get("/get-all-store/", authenticateToken, getAllStores);
router.post("/approve-shipper", authenticateToken, approveShipper);
router.post("/reject-shipper", authenticateToken, rejectShipper);

module.exports = router;
