const Staff = require("../models/staff");
const Store = require("../models/store");

const addStaff = async (req, res) => {
  const { phone, name, storeId } = req.body;

  try {
    // Kiểm tra nếu nhân viên với số điện thoại đã tồn tại
    const existingStaff = await Staff.findOne({ phone });
    if (existingStaff) {
      return res.status(400).json({ message: "Số điện thoại đã được sử dụng." });
    }

    // Kiểm tra xem storeId có hợp lệ không
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(400).json({ message: "Cửa hàng không tồn tại." });
    }

    // Tạo nhân viên mới
    const newStaff = new Staff({
      phone,
      name,
      store: storeId,
    });

    // Lưu nhân viên vào database
    const savedStaff = await newStaff.save();

    // Cập nhật danh sách nhân viên trong cửa hàng (chỉ thêm staffId, roleId ban đầu là null)
    store.staffList.push({ staffId: savedStaff._id, roleId: null });
    await store.save();

    return res.status(200).json({ message: "Thêm nhân viên thành công.", staff: savedStaff });
  } catch (error) {
    console.error("Lỗi khi thêm nhân viên:", error); // Log đầy đủ lỗi
    return res.status(500).json({ message: "Lỗi hệ thống. Vui lòng thử lại sau.", error: error.message });
  }
};

// Hàm lấy danh sách nhân viên theo storeId hoặc chi tiết của một nhân viên theo staffId
const getStaff = async (req, res) => {
  const { storeId, staffId } = req.query; // Lấy storeId hoặc staffId từ query params

  try {
    if (staffId) {
      // Nếu có staffId, tìm nhân viên theo staffId
      const staff = await Staff.findById(staffId).populate("store");
      if (!staff) {
        return res.status(404).json({ message: "Không tìm thấy nhân viên." });
      }
      return res.status(200).json({ message: "Lấy thông tin nhân viên thành công.", staff });
    }

    if (storeId) {
      // Nếu có storeId, lấy danh sách nhân viên của cửa hàng
      const staffList = await Staff.find({ store: storeId });
      return res.status(200).json({ message: "Lấy danh sách nhân viên thành công.", staff: staffList });
    }

    return res.status(400).json({ message: "Cần cung cấp storeId hoặc staffId." });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi hệ thống. Vui lòng thử lại sau.", error });
  }
};

// Hàm cập nhật thông tin nhân viên
const updateStaff = async (req, res) => {
  const { staffId } = req.params; // Lấy staffId từ URL params
  const { phone, name, isActive } = req.body; // Lấy thông tin cần cập nhật từ body của request

  try {
    // Kiểm tra nếu nhân viên tồn tại
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    // Cập nhật thông tin nhân viên
    staff.phone = phone || staff.phone;
    staff.name = name || staff.name;
    staff.isActive = isActive !== undefined ? isActive : staff.isActive;

    // Lưu thông tin nhân viên đã cập nhật
    await staff.save();

    return res.status(200).json({ message: "Cập nhật thông tin nhân viên thành công.", staff });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi hệ thống. Vui lòng thử lại sau.", error });
  }
};

module.exports = { addStaff, getStaff, updateStaff };
