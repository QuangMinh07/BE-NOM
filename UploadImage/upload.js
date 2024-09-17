const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../UploadImage/cloudinaryConfig");

// Cấu hình multer storage với Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "user_images", // Thư mục trên Cloudinary
    format: async (req, file) => "jpeg", // Định dạng file
    public_id: (req, file) => Date.now() + "_" + file.originalname, // Tạo tên file
  },
});

// Khởi tạo multer với cấu hình Cloudinary storage
const upload = multer({ storage });

module.exports = upload;
