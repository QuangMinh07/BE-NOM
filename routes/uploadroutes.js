const express = require("express");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");
const UserPersonalInfo = require("../models/userPersonal");
const router = express.Router();
const Store = require("../models/store");

// Cấu hình CloudinaryStorage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "profile_pictures", // Thư mục trên Cloudinary
    allowed_formats: ["jpg", "png"],
  },
});

const upload = multer({ storage });

// API để upload ảnh lên Cloudinary
router.post("/uploadProfilePicture/:userId", upload.single("image"), async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm UserPersonalInfo theo userId
    const userPersonalInfo = await UserPersonalInfo.findOne({ userId });

    if (!userPersonalInfo) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    // Upload ảnh lên Cloudinary trực tiếp
    const result = await cloudinary.uploader.upload(req.file.path);

    // Cập nhật profilePictureURL với đường dẫn ảnh từ Cloudinary
    userPersonalInfo.profilePictureURL = result.secure_url;

    // Lưu lại thông tin
    await userPersonalInfo.save();

    res.status(200).json({
      message: "Upload thành công!",
      profilePictureURL: result.secure_url,
    });
  } catch (error) {
    console.error("Lỗi khi upload ảnh:", error);
    res.status(500).json({ message: "Lỗi khi upload ảnh", error });
  }
});

router.post("/uploadStoreImage/:storeId", upload.single("image"), async (req, res) => {
  try {
    const { storeId } = req.params;

    // Tìm cửa hàng theo storeId
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Upload ảnh lên Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);

    // Cập nhật imageURL với đường dẫn ảnh từ Cloudinary
    store.imageURL = result.secure_url;

    // Lưu lại thông tin
    await store.save();

    res.status(200).json({
      message: "Upload ảnh cửa hàng thành công!",
      imageURL: result.secure_url,
    });
  } catch (error) {
    console.error("Lỗi khi upload ảnh:", error);
    res.status(500).json({ message: "Lỗi khi upload ảnh", error });
  }
});

module.exports = router;
