const User = require("../models/user");
const cloudinary = require("../UploadImage/cloudinaryConfig");

// Hàm upload hình ảnh và cập nhật thông tin user
const uploadImage = async (req, res) => {
  try {
    const { userId } = req.body;

    // Kiểm tra xem người dùng có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra nếu không có file upload
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên một file ảnh" });
    }

    // Xóa hình ảnh cũ trên Cloudinary nếu có
    if (user.idImage) {
      const publicId = user.idImage.split("/").pop().split(".")[0]; // Tách public_id từ URL
      await cloudinary.uploader.destroy(publicId); // Xóa hình ảnh cũ
    }

    // Tải ảnh mới lên Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "user_images", // Tên folder bạn muốn tạo hoặc lưu ảnh vào
    });

    // Cập nhật đường dẫn ảnh mới từ Cloudinary
    user.idImage = result.secure_url; // Đường dẫn ảnh được lưu trên Cloudinary
    await user.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật hình ảnh thành công",
      imageUrl: result.secure_url,
    });
  } catch (error) {
    console.error("Lỗi khi upload hình ảnh:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = {
  uploadImage,
};
