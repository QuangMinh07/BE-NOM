const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình CloudinaryStorage cho multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Thư mục lưu trên Cloudinary
    format: async (req, file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === ".jpeg" || ext === ".jpg") return "jpg";
      if (ext === ".png") return "png";
      if (ext === ".gif") return "gif";
      return "jpg"; // Định dạng mặc định là jpg
    },
    public_id: (req, file) => {
      return file.originalname.split('.')[0]; // Lưu với tên file gốc (không có đuôi)
    },
  },
});

// Hàm kiểm tra định dạng file
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb("Error: File upload phải là hình ảnh!");
  }
}

// Cấu hình multer
const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // Giới hạn dung lượng file là 5MB
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

// API upload base64 image
router.post("/uploadBase64", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    console.log(imageBase64);

    // Kiểm tra xem có dữ liệu base64 không
    if (!imageBase64) {
      return res.status(405).json({ message: "Thiếu dữ liệu Base64!" });
    }

    // Kiểm tra định dạng base64
    if (!imageBase64.startsWith("data:image")) {
      return res.status(401).json({ message: "Sai định dạng Base64!" });
    }

    // Upload image lên Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(imageBase64, {
      folder: "uploads",
    });

    // Trả về URL của ảnh sau khi upload thành công
    res.json({ url: uploadResponse.secure_url });
  } catch (err) {
    console.error("Cloudinary Error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

module.exports = router;
