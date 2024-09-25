const Store = require("../models/store");
const User = require("../models/user"); // Đảm bảo rằng bạn có mô hình User

// Hàm lấy thông tin cửa hàng theo userId từ query parameters
const getStoreByUser = async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ params

    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    // Tìm cửa hàng theo userId
    const store = await Store.findOne({ owner: userId }).populate(
      "owner",
      "userName email"
    );

    if (!store) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy cửa hàng" });
    }

    res.status(200).json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error("Lỗi khi lấy cửa hàng:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// Hàm cập nhật tên và địa chỉ cửa hàng theo storeId
const updateStoreById = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params
    const { storeName, storeAddress } = req.body; // Lấy storeName và storeAddress từ body của request

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Thiếu storeId" });
    }

    // Kiểm tra nếu không có dữ liệu để cập nhật
    if (!storeName && !storeAddress) {
      return res
        .status(400)
        .json({ success: false, message: "Không có thông tin để cập nhật" });
    }

    // Tìm cửa hàng bằng storeId
    const store = await Store.findById(storeId);
    if (!store) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy cửa hàng" });
    }

    // Cập nhật thông tin cửa hàng
    store.storeName = storeName || store.storeName;
    store.storeAddress = storeAddress || store.storeAddress;
    store.updatedAt = Date.now();

    // Lưu thông tin cửa hàng
    await store.save();

    // Tìm người dùng sở hữu cửa hàng
    const user = await User.findById(store.owner).populate({
      path: "storeIds",
      model: "Store",
      select: "storeName storeAddress",
    });

    if (user) {
      // Tìm và cập nhật thông tin cửa hàng trong mảng `storeIds`
      const storeIndex = user.storeIds.findIndex(
        (userStore) => userStore._id.toString() === storeId
      );

      if (storeIndex !== -1) {
        user.storeIds[storeIndex].storeName =
          storeName || user.storeIds[storeIndex].storeName;
        user.storeIds[storeIndex].storeAddress =
          storeAddress || user.storeIds[storeIndex].storeAddress;
      }

      // Lưu lại người dùng sau khi cập nhật
      await user.save();

      // Log ra thông tin người dùng sau khi cập nhật
      console.log("Updated user with store information:", user);
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin cửa hàng và người dùng thành công",
      store,
      user, // Trả về thông tin người dùng đã cập nhật
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật cửa hàng:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// Hàm tạo cửa hàng mới dựa trên userId
const createStore = async (req, res) => {
  const { userId, storeName, storeAddress, bankAccount, foodType } = req.body;

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId).populate("storeIds");

    // Kiểm tra xem người dùng có tồn tại không
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra nếu người dùng không phải là người bán hoặc chưa được duyệt
    if (user.roleId !== "seller" || !user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không phải người bán hoặc chưa được duyệt",
      });
    }

    // Tạo cửa hàng mới cho người bán
    const newStore = new Store({
      storeName, // Tên cửa hàng lấy từ request body
      owner: userId, // Liên kết với userId của người bán
      storeAddress, // Địa chỉ cửa hàng lấy từ request body
      bankAccount, // Tài khoản ngân hàng từ request body
      foodType, // Loại thực phẩm từ request body
    });

    // Lưu cửa hàng vào cơ sở dữ liệu
    await newStore.save();

    // Thêm storeId của cửa hàng mới vào mảng storeIds của người dùng
    user.storeIds.push(newStore._id);

    // Tăng số lượng cửa hàng của người dùng
    await User.findByIdAndUpdate(userId, { $inc: { storeCount: 1 } });

    // Lưu lại thông tin người dùng
    await user.save();

    // Log ra thông tin người dùng sau khi cập nhật
    const updatedUser = await User.findById(userId).populate({
      path: "storeIds",
      select: "storeName storeAddress bankAccount foodType", // Các trường cần thiết của cửa hàng
    });

    console.log("Updated user with new store:", updatedUser);

    res.status(201).json({
      message: "Cửa hàng đã được tạo thành công",
      store: newStore,
      user: updatedUser, // Trả về thông tin người dùng đã cập nhật
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const deleteStoreById = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Thiếu storeId" });
    }

    // Tìm cửa hàng bằng storeId
    const store = await Store.findById(storeId);
    if (!store) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy cửa hàng" });
    }

    // Xóa cửa hàng từ bảng `Store`
    await Store.findByIdAndDelete(storeId);

    // Tìm người dùng và xóa cửa hàng khỏi mảng `storeIds`
    const user = await User.findById(store.owner);
    if (user) {
      // Lọc lại mảng `storeIds`, loại bỏ cửa hàng có `storeId`
      user.storeIds = user.storeIds.filter(
        (userStoreId) => userStoreId.toString() !== storeId
      );

      // Giảm số lượng cửa hàng
      user.storeCount = Math.max(0, user.storeCount - 1); // Đảm bảo không bị âm

      // Lưu thông tin người dùng sau khi cập nhật mảng `storeIds`
      await user.save();

      // Populate thông tin cửa hàng còn lại
      const updatedUser = await User.findById(user._id).populate({
        path: "storeIds",
        select: "storeName storeAddress bankAccount foodType", // Các trường cần thiết của cửa hàng
      });

      // Log thông tin người dùng sau khi cập nhật
      console.log("Thông tin người dùng sau khi xóa cửa hàng:", updatedUser);

      res.status(200).json({
        success: true,
        message: "Cửa hàng đã được xóa thành công",
        user: updatedUser, // Trả về thông tin người dùng sau khi xóa và populate
      });
    }
  } catch (error) {
    console.error("Lỗi khi xóa cửa hàng:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};


module.exports = {
  getStoreByUser,
  updateStoreById,
  createStore,
  deleteStoreById,
};