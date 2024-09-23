const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");
require("dotenv").config(); // Để lấy thông tin từ file .env

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình lưu trữ bằng Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Thư mục lưu trên Cloudinary
    format: async (req, file) => {
      // Lấy định dạng từ tên file
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === ".jpeg" || ext === ".jpg") {
        return "jpg";
      }
      if (ext === ".png") {
        return "png";
      }
      if (ext === ".gif") {
        return "gif";
      }
      return "jpg"; // Định dạng mặc định
    },
    public_id: (req, file) => {
      return file.originalname.split('.')[0]; // Lưu với tên file gốc (không có đuôi)
    },
  },
});

// Cấu hình multer
const upload = multer({
  storage,
  limits: { fileSize: 5000000 }, // Giới hạn dung lượng file là 5MB
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

// Hàm kiểm tra định dạng file
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb("Error: File upload phải là hình ảnh!");
  }
}

module.exports = { upload };
