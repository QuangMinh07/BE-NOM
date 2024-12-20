const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");
const { searchFoods, toggleDiscountAcceptance, addDiscountToFood, getFoodWithCombo, updateFoodItem, addFoodItem, getFoodById, getFoodsByStoreId, deleteFoodItem, getAllFoods, updateFoodAvailability } = require("../controllers/foodcontrollers");
const { authenticateToken } = require("../middlewares/authMiddleware");

// Cấu hình CloudinaryStorage để upload ảnh vào thư mục "food_images"
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "food_images", // Thư mục chứa ảnh thức ăn trên Cloudinary
    allowed_formats: ["jpg", "png"],
  },
});

const upload = multer({ storage }); // Khởi tạo multer sau khi cấu hình storage
const router = express.Router();

// Route cho đăng ký người dùng
router.post("/add-food", upload.single("image"), authenticateToken, addFoodItem);
router.put("/edit-food/:foodId", upload.single("image"), authenticateToken, updateFoodItem);
router.put("/update-availability/:foodId", authenticateToken, updateFoodAvailability);

// Route lấy thông tin món ăn dựa trên foodId
router.get("/get-food/:foodId", authenticateToken, getFoodById);
router.get("/get-foodcombo/:foodId", authenticateToken, getFoodWithCombo);

// Route xóa món ăn dựa trên foodId
router.delete("/delete/:foodId", authenticateToken, deleteFoodItem);

// Route lấy tất cả món ăn của cửa hàng dựa trên storeId
router.get("/get-foodstore/:storeId", authenticateToken, getFoodsByStoreId);
router.get("/getAllfood", authenticateToken, getAllFoods);
router.put("/discount/:foodId", authenticateToken, addDiscountToFood);
router.put("/toggle-discount/:foodId", authenticateToken, toggleDiscountAcceptance);
router.get("/search", authenticateToken, searchFoods);

module.exports = router;
