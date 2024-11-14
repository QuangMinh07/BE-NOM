const Store = require("../models/store");
const User = require("../models/user"); // Đảm bảo rằng bạn có mô hình User
const moment = require("moment-timezone");
const Food = require("../models/food");

// Hàm lấy thông tin cửa hàng theo userId từ query parameters
const getStoreByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Received userId:", userId);

    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    // Lấy user từ cơ sở dữ liệu để kiểm tra `storeIds`
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Tìm cửa hàng bằng cách kiểm tra `storeIds`
    const store = await Store.findOne({
      _id: { $in: user.storeIds },
    }).populate("owner", "userName email");

    if (!store) {
      console.log("Không tìm thấy cửa hàng cho userId:", userId);
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng" });
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

// Hàm lấy thông tin cửa hàng theo storeId từ params
const getStoreById = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Thiếu storeId" });
    }

    // Tìm cửa hàng bằng storeId
    const store = await Store.findById(storeId).populate("owner", "userName email");

    if (!store) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng" });
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

const updateStoreById = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params
    const { storeName, storeAddress } = req.body; // Lấy storeName và storeAddress từ body của request

    if (!storeId) {
      return res.status(400).json({ success: false, message: "Thiếu storeId" });
    }

    // Kiểm tra nếu không có dữ liệu để cập nhật
    if (!storeName && !storeAddress) {
      return res.status(400).json({ success: false, message: "Không có thông tin để cập nhật" });
    }

    // Tìm cửa hàng bằng storeId
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng" });
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
      const storeIndex = user.storeIds.findIndex((userStore) => userStore._id.toString() === storeId);

      if (storeIndex !== -1) {
        user.storeIds[storeIndex].storeName = storeName || user.storeIds[storeIndex].storeName;
        user.storeIds[storeIndex].storeAddress = storeAddress || user.storeIds[storeIndex].storeAddress;
      }

      // Lưu lại người dùng sau khi cập nhật
      await user.save();

      // Log ra thông tin người dùng sau khi cập nhật
      console.log("Updated user with store information:", user);
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin cửa hàng và người dùng thành công",
      store, // Trả về store đã được cập nhật
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
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng" });
    }

    // Xóa cửa hàng từ bảng `Store`
    await Store.findByIdAndDelete(storeId);

    // Tìm người dùng và xóa cửa hàng khỏi mảng `storeIds`
    const user = await User.findById(store.owner);
    if (user) {
      // Lọc lại mảng `storeIds`, loại bỏ cửa hàng có `storeId`
      user.storeIds = user.storeIds.filter((userStoreId) => userStoreId.toString() !== storeId);

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

const addSellingTimeToStore = async (req, res) => {
  try {
    console.log("Request nhận được từ client:", req.body); // Log request nhận được

    const { storeId } = req.params;
    const { sellingTime } = req.body;

    // Kiểm tra storeId
    if (!storeId) {
      console.log("Thiếu storeId trong params");
      return res.status(400).json({
        success: false,
        message: "Thiếu storeId",
      });
    }

    // Kiểm tra dữ liệu sellingTime
    if (!sellingTime || !Array.isArray(sellingTime)) {
      console.log("Dữ liệu sellingTime không hợp lệ hoặc thiếu");
      return res.status(400).json({
        success: false,
        message: "Thiếu hoặc dữ liệu thời gian bán không hợp lệ",
      });
    }

    // Kiểm tra chi tiết sellingTime
    for (const day of sellingTime) {
      if (!day.day || !Array.isArray(day.timeSlots)) {
        console.log("Ngày hoặc timeSlots không hợp lệ cho ngày:", day);
        return res.status(400).json({
          success: false,
          message: "Dữ liệu ngày hoặc timeSlots không hợp lệ",
        });
      }

      for (const slot of day.timeSlots) {
        if (!slot.open || !slot.close) {
          console.log("Giờ mở hoặc giờ đóng không hợp lệ cho slot:", slot);
          return res.status(400).json({
            success: false,
            message: "Dữ liệu giờ mở/đóng không hợp lệ",
          });
        }
      }
    }

    // Tìm cửa hàng bằng storeId
    const store = await Store.findById(storeId);
    if (!store) {
      console.log("Không tìm thấy cửa hàng với storeId:", storeId);
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cửa hàng",
      });
    }

    // Định dạng lại dữ liệu sellingTime
    const formattedSellingTime = sellingTime.map((dayData) => {
      if (dayData.is24h) {
        return {
          day: dayData.day,
          is24h: true,
          timeSlots: [
            {
              open: "00:00",
              close: "23:59",
            },
          ],
        };
      } else {
        return {
          day: dayData.day,
          is24h: false,
          timeSlots: dayData.timeSlots.map((slot) => ({
            open: slot.open,
            close: slot.close,
          })),
        };
      }
    });

    // Thêm thời gian bán hàng mới vào store
    console.log("Thêm thời gian bán hàng:", formattedSellingTime);
    store.sellingTime = [...store.sellingTime, ...formattedSellingTime];
    store.updatedAt = Date.now();

    // Kiểm tra trạng thái cửa hàng có đang mở hay không
    store.isOpen = checkStoreOpenStatus(store.sellingTime);

    // Lưu thông tin store
    await store.save();

    console.log("Lưu thành công thời gian bán hàng cho store:", storeId);
    res.status(200).json({
      success: true,
      message: "Thêm thời gian bán hàng thành công",
      store,
      isOpen: store.isOpen, // Trả về trạng thái mở cửa
    });
  } catch (error) {
    console.error("Lỗi khi thêm thời gian bán hàng:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ",
    });
  }
};

const checkStoreOpenStatus = (sellingTime) => {
  // Lấy thời gian hiện tại theo múi giờ Việt Nam (GMT+7)
  const now = moment().tz("Asia/Ho_Chi_Minh");

  // Lấy tên ngày hiện tại và chuyển đổi từ tiếng Anh sang tiếng Việt
  const currentDay = now.format("dddd");
  const dayMapping = {
    Monday: "Thứ 2",
    Tuesday: "Thứ 3",
    Wednesday: "Thứ 4",
    Thursday: "Thứ 5",
    Friday: "Thứ 6",
    Saturday: "Thứ 7",
    Sunday: "Chủ nhật",
  };
  const currentDayInVietnamese = dayMapping[currentDay] || currentDay;

  const currentTime = now.hours() * 60 + now.minutes(); // Tính thời gian hiện tại dưới dạng phút trong ngày

  // Tìm thời gian bán hàng cho ngày hiện tại
  const daySchedule = sellingTime.find((day) => day.day === currentDayInVietnamese);

  if (!daySchedule || daySchedule.timeSlots.length === 0) {
    return false; // Nếu không có thời gian bán hàng cho ngày hiện tại, trả về false
  }

  // Kiểm tra tất cả các khung giờ của ngày hiện tại
  for (const slot of daySchedule.timeSlots) {
    const [openHour, openMinute] = slot.open.split(":").map(Number);
    const [closeHour, closeMinute] = slot.close.split(":").map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    // Kiểm tra nếu thời gian hiện tại nằm trong khoảng mở bán
    if (currentTime >= openTime && currentTime <= closeTime) {
      return true;
    }
  }

  return false;
};

// API để kiểm tra và cập nhật trạng thái mở cửa
const checkStoreOpen = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params

    // Tìm cửa hàng bằng storeId
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng" });
    }

    // Kiểm tra trạng thái mở cửa dựa trên sellingTime
    const isOpen = checkStoreOpenStatus(store.sellingTime);

    // Cập nhật trường isOpen trong database nếu có thay đổi
    if (store.isOpen !== isOpen) {
      store.isOpen = isOpen; // Cập nhật giá trị isOpen
      store.updatedAt = Date.now(); // Cập nhật thời gian chỉnh sửa
      await store.save(); // Lưu thay đổi vào cơ sở dữ liệu
    }

    res.status(200).json({
      success: true,
      message: `Cửa hàng ${isOpen ? "đang mở" : "đã đóng"}`,
      isOpen, // Trả về trạng thái của cửa hàng
    });
  } catch (error) {
    console.error("Lỗi khi kiểm tra và cập nhật trạng thái mở cửa:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

const getAllStores = async (req, res) => {
  try {
    // Lấy tất cả cửa hàng từ cơ sở dữ liệu và populate thông tin chủ cửa hàng
    const stores = await Store.find().populate("owner", "userName email");

    if (!stores || stores.length === 0) {
      return res.status(404).json({
        success: false,
        msg: "Không có cửa hàng nào trong hệ thống",
      });
    }

    res.status(200).json({
      success: true,
      msg: "Lấy danh sách cửa hàng thành công",
      data: stores,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách cửa hàng:", error.message);
    res.status(500).json({
      success: false,
      msg: "Lỗi máy chủ, không thể lấy danh sách cửa hàng",
      error: error.message,
    });
  }
};

const searchStores = async (req, res) => {
  try {
    const query = {};

    // Lấy các tham số tìm kiếm từ query
    const { storeName, storeAddress, owner, foodType, isOpen } = req.query;

    // Nếu có storeName trong query, thêm điều kiện tìm kiếm cho storeName
    if (storeName) {
      query.storeName = { $regex: `^${storeName}`, $options: "i" }; // Tìm kiếm không phân biệt chữ hoa chữ thường
    }

    // Nếu có storeAddress trong query, thêm điều kiện tìm kiếm cho storeAddress
    if (storeAddress) {
      query.storeAddress = { $regex: storeAddress, $options: "i" };
    }

    // Nếu có owner (userId) trong query, thêm điều kiện tìm kiếm cho owner
    if (owner) {
      query.owner = owner;
    }

    // Nếu có foodType trong query, thêm điều kiện tìm kiếm cho foodType
    if (foodType) {
      query.foodType = { $regex: foodType, $options: "i" };
    }

    // Nếu có isOpen trong query, thêm điều kiện tìm kiếm cho isOpen
    if (isOpen !== undefined) {
      query.isOpen = isOpen === "true";
    }

    // Tìm kiếm cửa hàng theo các điều kiện trong query
    const stores = await Store.find(query).populate("owner", "userName email");

    // Thay đổi phản hồi khi không có kết quả thay vì trả về 404
    if (!stores || stores.length === 0) {
      return res.status(200).json({
        success: true,
        msg: "Không có cửa hàng nào khớp với điều kiện tìm kiếm",
        data: [], // Trả về mảng rỗng thay vì lỗi
      });
    }

    res.status(200).json({
      success: true,
      msg: "Tìm kiếm cửa hàng thành công",
      data: stores,
    });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm cửa hàng:", error.message);
    res.status(500).json({
      success: false,
      msg: "Lỗi máy chủ, không thể tìm kiếm cửa hàng",
      error: error.message,
    });
  }
};

const searchStoresAndFoods = async (req, res) => {
  try {
    const { searchTerm } = req.query;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        msg: "Vui lòng cung cấp từ khóa tìm kiếm",
      });
    }

    // Tìm kiếm trong bảng Store
    const storeQuery = { storeName: { $regex: searchTerm, $options: "i" } };
    const stores = await Store.find(storeQuery).populate("owner", "userName email");

    // Tìm kiếm trong bảng Food
    const foodQuery = { foodName: { $regex: searchTerm, $options: "i" } };
    const foods = await Food.find(foodQuery).populate("store", "storeName storeAddress").select("foodName price description imageUrl isAvailable");

    // Kiểm tra nếu không có kết quả tìm kiếm
    if (stores.length === 0 && foods.length === 0) {
      return res.status(200).json({
        success: true,
        msg: "Không có cửa hàng hoặc món ăn nào khớp với điều kiện tìm kiếm",
        data: { stores: [], foods: [] },
      });
    }

    res.status(200).json({
      success: true,
      msg: "Tìm kiếm thành công",
      data: {
        stores,
        foods,
      },
    });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm cửa hàng và món ăn:", error.message);
    res.status(500).json({
      success: false,
      msg: "Lỗi máy chủ, không thể tìm kiếm cửa hàng và món ăn",
      error: error.message,
    });
  }
};

// API lấy cửa hàng theo foodType
const getStoresByFoodType = async (req, res) => {
  try {
    const { foodType } = req.params; // Lấy foodType từ URL params
    console.log("Received foodType:", foodType); // Log để kiểm tra giá trị

    if (!foodType) {
      return res.status(400).json({
        success: false,
        msg: "Vui lòng cung cấp foodType",
      });
    }

    // Kiểm tra nếu foodType có dấu cách thừa
    const trimmedFoodType = foodType.trim();

    const stores = await Store.find({ foodType: trimmedFoodType }).populate("owner", "userName email");
    console.log("Stores found:", stores); // Log kết quả tìm kiếm

    if (!stores || stores.length === 0) {
      return res.status(404).json({
        success: false,
        msg: "Không có cửa hàng nào với loại món ăn này",
      });
    }

    res.status(200).json({
      success: true,
      msg: "Lấy danh sách cửa hàng thành công",
      data: stores,
    });
  } catch (error) {
    console.error("Lỗi khi lấy cửa hàng theo loại món ăn:", error.message);
    res.status(500).json({
      success: false,
      msg: "Lỗi máy chủ, không thể lấy danh sách cửa hàng",
      error: error.message,
    });
  }
};

module.exports = {
  getStoreByUser,
  updateStoreById,
  createStore,
  deleteStoreById,
  addSellingTimeToStore,
  getStoreById,
  getAllStores,
  checkStoreOpen,
  searchStores,
  searchStoresAndFoods,
  getStoresByFoodType,
};
