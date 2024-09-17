const express = require("express");
const router = express.Router();
const upload = require("../UploadImage/upload"); // Đường dẫn tới file cấu hình multer
const { uploadImage } = require("../controllers/UploadImage");

// API upload hình ảnh
router.post("/upload/upload-image", upload.single("image"), uploadImage);

module.exports = router;
