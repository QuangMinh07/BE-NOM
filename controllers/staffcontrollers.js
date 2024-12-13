const Staff = require("../models/staff");
const Store = require("../models/store");
const User = require("../models/user");

const addStaff = async (req, res) => {
  const { phone, name, storeId } = req.body;

  try {
    console.log("Bắt đầu thêm nhân viên với thông tin:", { phone, name, storeId });

    // Kiểm tra nếu số điện thoại đã tồn tại trong bảng nhân viên
    const existingStaff = await Staff.findOne({ phone });
    if (existingStaff) {
      console.log("Số điện thoại đã tồn tại trong bảng nhân viên:", phone);
      return res.status(400).json({ message: "Số điện thoại đã được sử dụng trong hệ thống nhân viên." });
    }

    // Kiểm tra số điện thoại trong bảng User
    const existingUser = await User.findOne({ phoneNumber: phone });
    let userId = null;
    if (existingUser) {
      console.log("Tìm thấy số điện thoại trong bảng User:", existingUser);

      // Kiểm tra vai trò hiện tại
      if (existingUser.roleId === "seller" || existingUser.roleId === "shipper" || existingUser.roleId === "staff") {
        console.log("Vai trò của số điện thoại không phù hợp:", existingUser.roleId);
        return res.status(400).json({ message: "Số điện thoại này đã có tài khoản với vai trò Seller hoặc Shipper hoặc Staff." });
      }

      if (existingUser.roleId === "customer") {
        console.log("Vai trò hiện tại là customer, cập nhật sang staff.");
        existingUser.roleId = "staff";

        // Lưu `userName` cũ vào `previousUserName`
        existingUser.previousUserName = existingUser.userName;

        // Cập nhật userName với tên được gửi từ request
        if (name) {
          existingUser.userName = name.toLowerCase(); // Chỉ chuyển thành chữ thường, giữ nguyên khoảng trắng
        }

        // Gắn thêm storeId vào mảng storeIds
        if (!existingUser.storeIds.includes(storeId)) {
          existingUser.storeIds.push(storeId);
          console.log("Gắn storeId vào storeIds:", storeId);
        }

        await existingUser.save();
        console.log("Cập nhật vai trò thành công:", existingUser);

        // Gán userId từ existingUser._id
        userId = existingUser._id;
      }
    } else {
      console.log("Không tìm thấy số điện thoại trong bảng User.");
    }

    // Kiểm tra xem storeId có hợp lệ không
    const store = await Store.findById(storeId);
    if (!store) {
      console.log("Không tìm thấy cửa hàng với storeId:", storeId);
      return res.status(400).json({ message: "Cửa hàng không tồn tại." });
    }

    console.log("Tạo nhân viên mới.");
    // Tạo nhân viên mới
    const newStaff = new Staff({
      phone,
      name,
      store: storeId,
      user: userId, // Lưu userId vào bảng Staff
    });

    // Lưu nhân viên vào database
    const savedStaff = await newStaff.save();
    console.log("Lưu nhân viên thành công:", savedStaff);

    // Cập nhật danh sách nhân viên trong cửa hàng
    store.staffList.push({ staffId: savedStaff._id, roleId: null });
    await store.save();
    console.log("Cập nhật danh sách nhân viên trong cửa hàng thành công.");

    return res.status(200).json({ status: 200, message: "Thêm nhân viên thành công.", staff: savedStaff });
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

const deleteStaff = async (req, res) => {
  const { staffId } = req.params; // Lấy staffId từ URL params

  try {
    // Kiểm tra nếu nhân viên tồn tại
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    // Lấy thông tin cửa hàng liên kết (nếu có)
    const store = await Store.findById(staff.store);
    if (store) {
      // Loại bỏ nhân viên khỏi danh sách nhân viên của cửa hàng
      store.staffList = store.staffList.filter((staffEntry) => staffEntry.staffId.toString() !== staffId);
      await store.save();
    }

    // Tìm người dùng có số điện thoại trùng với nhân viên bị xóa
    const user = await User.findOne({ phoneNumber: staff.phone });
    if (user) {
      // Cập nhật roleId và userName về giá trị ban đầu
      user.roleId = "customer";

      // Khôi phục userName từ `previousUserName`
      if (user.previousUserName) {
        user.userName = user.previousUserName;
        user.previousUserName = null; // Xóa giá trị lưu tạm sau khi khôi phục
      }

      // Xóa toàn bộ storeIds
      user.storeIds = [];

      await user.save();
      console.log("Cập nhật lại user thành công:", user);
    }

    // Xóa nhân viên khỏi database
    await Staff.findByIdAndDelete(staffId);

    return res.status(200).json({ status: 200, message: "Xóa nhân viên thành công." });
  } catch (error) {
    console.error("Lỗi khi xóa nhân viên:", error);
    return res.status(500).json({ message: "Lỗi hệ thống. Vui lòng thử lại sau.", error });
  }
};

module.exports = { addStaff, getStaff, updateStaff, deleteStaff };
