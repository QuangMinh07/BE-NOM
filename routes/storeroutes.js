const express = require("express");
const { getStoreByUser, updateStoreById, createStore, deleteStoreById, addSellingTimeToStore, getStoreById } = require("../controllers/storecontrollers");
const { authenticateToken } = require("../middlewares/authMiddleware");
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/getStore/:userId", authenticateToken, getStoreByUser);
router.post("/add-selling-time/:storeId", authenticateToken, addSellingTimeToStore);
router.put("/update-store/:storeId", authenticateToken, updateStoreById);
router.post("/create-store/", authenticateToken, createStore);
router.delete("/delete-store/:storeId", authenticateToken, deleteStoreById);
router.get("/get-store/:storeId", authenticateToken, getStoreById);

module.exports = router;
