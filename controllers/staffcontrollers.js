const Staff = require("../models/staff"); // Đường dẫn tới modal Staff của bạn

// Hàm thêm nhân viên mới
const addStaff = async (req, res) => {
  const { phone, name } = req.body;

  try {
    // Kiểm tra nếu nhân viên với số điện thoại đã tồn tại
    const existingStaff = await Staff.findOne({ phone });
    if (existingStaff) {
      return res
        .status(400)
        .json({ message: "Số điện thoại đã được sử dụng." });
    }

    // Tạo nhân viên mới
    const newStaff = new Staff({
      phone,
      name,
    });

    // Lưu vào database
    await newStaff.save();

    return res
      .status(200)
      .json({ message: "Thêm nhân viên thành công.", staff: newStaff });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi hệ thống. Vui lòng thử lại sau.", error });
  }
};

module.exports = { addStaff };
