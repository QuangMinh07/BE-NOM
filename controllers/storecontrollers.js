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
const createBranch = async (req, res) => {
  try {
    const { parentStoreId, branchName, branchAddress } = req.body;

    console.log("Received Parent Store ID:", parentStoreId, branchName, branchAddress);

    if (!parentStoreId || !branchName || !branchAddress) {
      return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin." });
    }

    // Tìm cửa hàng cha
    const parentStore = await Store.findById(parentStoreId).populate("foods").populate("foodGroups").populate("staffList");
    if (!parentStore) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng cha." });
    }

    const branchCount = parentStore.branches.length;
    if (branchCount >= 3) {
      return res.status(400).json({ message: "Bạn chỉ được tạo tối đa 3 chi nhánh." });
    }

    // Kiểm tra xem đã có chi nhánh nào với tên hoặc địa chỉ giống như chi nhánh mới tạo hay chưa
    const existingBranch = await Store.find({
      _id: { $in: parentStore.branches }, // Tìm các chi nhánh trong cửa hàng cha
      $or: [{ storeName: branchName.trim() }, { storeAddress: branchAddress.trim() }],
    });

    if (existingBranch.length > 0) {
      return res.status(400).json({ message: "Tên cửa hàng con hoặc địa chỉ đã tồn tại trong cửa hàng này." });
    }

    // Tạo chi nhánh mới với các thông tin từ cửa hàng cha, không cần tạo thêm cho cửa hàng cha
    const newBranch = new Store({
      storeName: `${parentStore.storeName} - ${branchName.trim()}`, // Tên cửa hàng con
      owner: parentStore.owner, // Chủ cửa hàng từ cửa hàng cha
      storeAddress: branchAddress.trim(), // Địa chỉ cửa hàng con
      averageRating: parentStore.averageRating || 0, // Đánh giá cửa hàng cha
      lockStatus: parentStore.lockStatus || "unlocked", // Trạng thái cửa hàng cha
      imageURL: parentStore.imageURL || "", // Ảnh cửa hàng cha
      foodType: parentStore.foodType || "", // Loại món ăn cửa hàng cha
      bankAccount: parentStore.bankAccount || "", // Tài khoản ngân hàng cửa hàng cha
      isOpen: parentStore.isOpen || false, // Trạng thái mở cửa cửa hàng cha
      sellingTime: parentStore.sellingTime || [], // Thời gian bán hàng của cửa hàng cha
      foods: parentStore.foods || [], // Danh sách món ăn của cửa hàng cha
      foodGroups: parentStore.foodGroups || [], // Nhóm món ăn của cửa hàng cha
      staffList: parentStore.staffList || [], // Danh sách nhân viên của cửa hàng cha
    });

    await newBranch.save();

    // Thêm chi nhánh vào danh sách của cửa hàng cha
    parentStore.branches.push(newBranch._id);
    await parentStore.save();

    res.status(201).json({
      message: "Chi nhánh được tạo thành công.",
      branch: newBranch,
    });
  } catch (error) {
    console.error("Lỗi khi tạo chi nhánh:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi tạo chi nhánh." });
  }
};

const getBranches = async (req, res) => {
  try {
    const { parentStoreId } = req.params; // Lấy ID cửa hàng cha từ URL params
    console.log("Fetching branches for Parent Store ID:", parentStoreId);

    if (!parentStoreId) {
      return res.status(400).json({ message: "Vui lòng cung cấp ID cửa hàng cha." });
    }

    // Tìm cửa hàng cha và populate danh sách chi nhánh
    const parentStore = await Store.findById(parentStoreId).populate({
      path: "branches",
      select: "storeName storeAddress averageRating isOpen", // Chỉ lấy các trường cần thiết
    });

    if (!parentStore) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng cha." });
    }

    res.status(200).json({
      message: "Lấy danh sách chi nhánh thành công.",
      branches: parentStore.branches,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách chi nhánh:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy danh sách chi nhánh." });
  }
};

const getBranchById = async (req, res) => {
  try {
    const { branchId } = req.params; // Lấy ID của chi nhánh từ URL params
    console.log("Fetching details for Branch ID:", branchId);

    if (!branchId) {
      return res.status(400).json({ message: "Vui lòng cung cấp ID chi nhánh." });
    }

    // Tìm chi nhánh theo ID
    const branch = await Store.findById(branchId).select("storeName storeAddress averageRating isOpen sellingTime"); // Lấy các trường cần thiết

    if (!branch) {
      return res.status(404).json({ message: "Không tìm thấy chi nhánh." });
    }

    res.status(200).json({
      message: "Lấy thông tin chi nhánh thành công.",
      branch,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin chi nhánh:", error);
    res.status(500).json({ message: "Đã xảy ra lỗi khi lấy thông tin chi nhánh." });
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

    // Ghi đè thời gian bán hàng cũ với dữ liệu mới
    store.sellingTime = formattedSellingTime;
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
    const foods = await Food.find(foodQuery).populate("store", "storeName storeAddress").select("foodName price description imageUrl isAvailable discountedPrice isDiscounted");

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

const deleteBranchById = async (req, res) => {
  try {
    const { parentStoreId, branchId } = req.params;

    if (!parentStoreId || !branchId) {
      return res.status(400).json({ success: false, message: "Thiếu parentStoreId hoặc branchId" });
    }

    // Tìm cửa hàng cha
    const parentStore = await Store.findById(parentStoreId);
    if (!parentStore) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng cha" });
    }

    // Tìm cửa hàng con (chi nhánh)
    const branch = await Store.findById(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cửa hàng con" });
    }

    // Xóa cửa hàng con khỏi cơ sở dữ liệu
    await Store.findByIdAndDelete(branchId);

    // Loại bỏ chi nhánh khỏi danh sách chi nhánh của cửa hàng cha
    console.log("Branches trước khi xóa:", parentStore.branches);

    // So sánh ObjectId để loại bỏ đúng chi nhánh
    parentStore.branches = parentStore.branches.filter((branchObjId) => branchObjId.toString() !== branchId.toString());

    console.log("Branches sau khi xóa:", parentStore.branches);

    await parentStore.save();

    res.status(200).json({
      success: true,
      message: "Cửa hàng con đã được xóa thành công.",
      parentStore, // Trả về thông tin cửa hàng cha sau khi xóa chi nhánh
    });
  } catch (error) {
    console.error("Lỗi khi xóa cửa hàng con:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

module.exports = {
  getStoreByUser,
  updateStoreById,
  createBranch,
  deleteStoreById,
  addSellingTimeToStore,
  getStoreById,
  getAllStores,
  checkStoreOpen,
  searchStores,
  searchStoresAndFoods,
  getStoresByFoodType,
  getBranches,
  getBranchById,
  deleteBranchById,
};
