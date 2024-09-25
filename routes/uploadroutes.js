const express = require("express");
const router = express.Router();
const { upload } = require("../utils/upload");
const cloudinary = require("cloudinary").v2;

router.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Chưa có file được tải lên" });
  }
  // Sau khi upload thành công, Cloudinary trả về thông tin của file
  res.json({
    url: req.file.path, // Đường dẫn URL trên Cloudinary
    id: req.file.filename, // Tên file trên Cloudinary
  });
});

router.post("/uploadBase64", async (req, res) => {
  try {
    console.log("Received payload:", req.body);
    // Kiểm tra nếu imageBase64 có dữ liệu hợp lệ không
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ message: "Thiếu dữ liệu Base64!" });
    }

    if (!imageBase64.startsWith("data:image")) {
      return res.status(400).json({ message: "Sai định dạng Base64!" });
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
