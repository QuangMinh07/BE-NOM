const express = require("express");
const {
  getStoreByUser,
  updateStoreById,
  createStore,
  deleteStoreById,
} = require("../controllers/storecontrollers");
const { authenticateToken } = require("../middlewares/authMiddleware");
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/getStore/:userId", authenticateToken, getStoreByUser);
router.put("/update-store/:storeId", authenticateToken, updateStoreById);
router.post("/create-store/", authenticateToken, createStore);
router.delete("/delete-store/:storeId", authenticateToken, deleteStoreById);

module.exports = router;