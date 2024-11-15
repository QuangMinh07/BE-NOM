const express = require("express");
const { getStoreByUser, updateStoreById, getStoresByFoodType, createStore, deleteStoreById, addSellingTimeToStore, getStoreById, getAllStores, checkStoreOpen, searchStores, searchStoresAndFoods } = require("../controllers/storecontrollers");
const { authenticateToken, restrictToSeller } = require("../middlewares/authMiddleware");
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/search", authenticateToken, searchStores);
router.get("/search-all", authenticateToken, searchStoresAndFoods);
router.get("/getStore/:userId", authenticateToken, getStoreByUser);
router.post("/add-selling-time/:storeId", authenticateToken, restrictToSeller, addSellingTimeToStore);
router.put("/update-store/:storeId", authenticateToken, restrictToSeller, updateStoreById);
router.post("/create-store/", authenticateToken, createStore);
router.delete("/delete-store/:storeId", authenticateToken, deleteStoreById);
router.get("/get-store/:storeId", authenticateToken, getStoreById);
router.get("/get-all-store/", authenticateToken, getAllStores);
router.get("/check-store-open/:storeId", authenticateToken, checkStoreOpen);
router.get("/by-food-type/:foodType", authenticateToken, getStoresByFoodType);

module.exports = router;
