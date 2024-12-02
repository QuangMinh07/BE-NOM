const express = require("express");
const { deleteBranchById, getBranchById, getBranches, getStoreByUser, updateStoreById, getStoresByFoodType, createBranch, deleteStoreById, addSellingTimeToStore, getStoreById, getAllStores, checkStoreOpen, searchStores, searchStoresAndFoods } = require("../controllers/storecontrollers");
const { authenticateToken, restrictToSeller } = require("../middlewares/authMiddleware");
const router = express.Router();

// Đảm bảo route này tồn tại trong file routes
router.get("/search", authenticateToken, searchStores);
router.get("/search-all", authenticateToken, searchStoresAndFoods);
router.get("/getStore/:userId", authenticateToken, getStoreByUser);
router.post("/add-selling-time/:storeId", authenticateToken, restrictToSeller, addSellingTimeToStore);
router.put("/update-store/:storeId", authenticateToken, restrictToSeller, updateStoreById);
router.post("/create-store/", authenticateToken, createBranch);
router.get("/get-branch/:parentStoreId", authenticateToken, getBranches);
router.get("/get-branchById/:branchId", authenticateToken, getBranchById);
router.delete("/delete-store/:storeId", authenticateToken, deleteStoreById);
router.get("/get-store/:storeId", authenticateToken, getStoreById);
router.get("/get-all-store/", authenticateToken, getAllStores);
router.get("/check-store-open/:storeId", authenticateToken, checkStoreOpen);
router.get("/by-food-type/:foodType", authenticateToken, getStoresByFoodType);
router.delete("/delete-branch/:parentStoreId/:branchId", authenticateToken, deleteBranchById);

module.exports = router;
