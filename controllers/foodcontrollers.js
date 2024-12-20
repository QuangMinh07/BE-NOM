const Food = require("../models/food");
const Store = require("../models/store");
const FoodGroup = require("../models/foodgroup"); // Import model FoodGroup

const cloudinary = require("../config/cloudinaryConfig");

// API để thêm món ăn mới và upload ảnh lên Cloudinary
const addFoodItem = async (req, res) => {
  const { storeId, foodName, price, description, foodGroup, isAvailable, sellingTime } = req.body;

  try {
    console.log("Store ID từ client:", storeId);

    // Kiểm tra các trường bắt buộc
    if (!storeId || !foodName || !price || !foodGroup) {
      return res.status(400).json({ message: "Vui lòng cung cấp đầy đủ thông tin bắt buộc (tên món, giá, nhóm món, cửa hàng)." });
    }

    // Kiểm tra giá trị của giá
    if (price <= 0) {
      return res.status(400).json({ message: "Giá món ăn phải lớn hơn 0." });
    }

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Nếu có ảnh, upload ảnh lên Cloudinary
    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url; // Lưu URL ảnh vào imageUrl
    } else {
      return res.status(400).json({ message: "Vui lòng tải lên ảnh món ăn." });
    }

    // Chuyển đổi sellingTime từ frontend sang định dạng MongoDB
    let formattedSellingTime;
    let note = null;

    if (sellingTime) {
      console.log("Đã nhận sellingTime từ client:", sellingTime);
      formattedSellingTime = JSON.parse(sellingTime).map((dayData) => {
        if (dayData.is24h) {
          return {
            day: dayData.day,
            is24h: true,
            timeSlots: [{ open: "00:00", close: "23:59" }],
          };
        } else {
          return {
            day: dayData.day,
            is24h: false,
            timeSlots: dayData.timeSlots.map((slot) => ({
              open: slot.startTime,
              close: slot.endTime,
            })),
          };
        }
      });
    } else {
      console.log("Không nhận được sellingTime từ client. Áp dụng giờ mặc định.");
      note = "Chưa chọn giờ bán. Sử dụng giờ mặc định: full tuần và full 24h.";
      formattedSellingTime = Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        is24h: true,
        timeSlots: [{ open: "00:00", close: "23:59" }],
      }));
    }

    // Tạo món ăn mới
    const newFood = new Food({
      foodName,
      price,
      description,
      store: storeId,
      imageUrl, // Lưu URL ảnh vào món ăn
      foodGroup,
      isAvailable,
      sellingTime: formattedSellingTime,
    });

    // Lưu món ăn mới vào MongoDB
    await newFood.save();

    // Thêm foodId vào danh sách món ăn của cửa hàng
    store.foods = store.foods ? [...store.foods, newFood._id] : [newFood._id];
    await store.save();

    // Cập nhật danh sách món ăn trong FoodGroup
    const foodGroupRecord = await FoodGroup.findById(foodGroup);
    if (foodGroupRecord) {
      foodGroupRecord.foods.push(newFood._id);
      await foodGroupRecord.save();
    } else {
      return res.status(404).json({ message: "Nhóm món không tồn tại" });
    }

    return res.status(200).json({
      message: "Thêm món ăn thành công",
      food: newFood,
      note, // Trường note được gửi đi
    });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi thêm món ăn" });
  }
};

const updateFoodItem = async (req, res) => {
  const { foodId } = req.params;
  const { foodName, price, description, foodGroup, isAvailable, sellingTime } = req.body;

  try {
    // Kiểm tra món ăn có tồn tại không
    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: "Món ăn không tồn tại" });
    }

    // Nếu có ảnh mới, upload ảnh lên Cloudinary
    let imageUrl = food.imageUrl; // Sử dụng URL ảnh hiện tại nếu không có ảnh mới
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
    }

    // Chuyển đổi sellingTime từ frontend sang định dạng MongoDB
    const formattedSellingTime = JSON.parse(sellingTime).map((dayData) => {
      if (dayData.is24h) {
        return {
          day: dayData.day,
          is24h: true,
          timeSlots: [{ open: "00:00", close: "23:59" }],
        };
      } else {
        return {
          day: dayData.day,
          is24h: false,
          timeSlots: dayData.timeSlots.map((slot) => ({
            open: slot.startTime,
            close: slot.endTime,
          })),
        };
      }
    });

    // Cập nhật các trường của món ăn
    food.foodName = foodName || food.foodName;
    food.price = price || food.price;
    food.description = description || food.description;
    food.imageUrl = imageUrl;
    if (typeof isAvailable !== "undefined") {
      food.isAvailable = isAvailable;
    }
    food.sellingTime = formattedSellingTime;

    // Chỉ cập nhật sellingTime nếu có trong request
    if (sellingTime) {
      const formattedSellingTime = JSON.parse(sellingTime).map((dayData) => {
        if (dayData.is24h) {
          return {
            day: dayData.day,
            is24h: true,
            timeSlots: [{ open: "00:00", close: "23:59" }],
          };
        } else {
          return {
            day: dayData.day,
            is24h: false,
            timeSlots: dayData.timeSlots.map((slot) => ({
              open: slot.startTime,
              close: slot.endTime,
            })),
          };
        }
      });
      food.sellingTime = formattedSellingTime;
    }

    // Xử lý foodGroup nếu có
    if (foodGroup) {
      const foodGroupRecord = await FoodGroup.findById(foodGroup);
      if (!foodGroupRecord) {
        return res.status(400).json({ message: "Nhóm món không hợp lệ" });
      }

      // Xóa foodId khỏi các nhóm món khác
      await FoodGroup.updateMany({ foods: food._id }, { $pull: { foods: food._id } });

      // Thêm foodId vào nhóm món hiện tại
      if (!foodGroupRecord.foods.includes(food._id)) {
        foodGroupRecord.foods.push(food._id);
        await foodGroupRecord.save();
      }

      food.foodGroup = foodGroup; // Cập nhật nhóm món cho món ăn
    }

    // Lưu món ăn đã cập nhật vào MongoDB
    await food.save();

    return res.status(200).json({ message: "Cập nhật món ăn thành công", food });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật món ăn" });
  }
};

// API lấy thông tin thức ăn dựa trên foodId
const getFoodById = async (req, res) => {
  const { foodId } = req.params;

  try {
    console.log("Fetching food by ID:", foodId); // Log kiểm tra foodId

    // Tìm món ăn theo foodId và populate store
    const foodItem = await Food.findById(foodId).populate("store");

    if (!foodItem) {
      return res.status(404).json({ message: "Không tìm thấy món ăn" });
    }

    res.status(200).json({
      message: "Lấy thông tin món ăn thành công",
      food: foodItem,
    });
  } catch (error) {
    console.error("Error fetching food by ID:", error); // Log chi tiết lỗi
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const getFoodsByStoreId = async (req, res) => {
  const { storeId } = req.params;

  try {
    // Tìm tất cả món ăn thuộc cửa hàng với storeId
    const foodItems = await Food.find({ store: storeId }).populate("store");

    if (!foodItems || foodItems.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy món ăn nào" });
    }

    res.status(200).json({
      message: "Lấy tất cả món ăn thành công",
      foods: foodItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const deleteFoodItem = async (req, res) => {
  const { foodId } = req.params;

  if (!foodId || foodId === "undefined") {
    return res.status(400).json({ success: false, msg: "ID món ăn không hợp lệ." });
  }

  try {
    const deletedFood = await Food.findByIdAndDelete(foodId);

    if (!deletedFood) {
      return res.status(404).json({ message: "Không tìm thấy món ăn" });
    }

    // Xóa món ăn khỏi danh sách `foods` trong các nhóm món
    await FoodGroup.updateMany(
      { foods: foodId },
      { $pull: { foods: foodId } } // Xóa món ăn khỏi mảng `foods`
    );

    // Xóa món ăn khỏi danh sách `foods` trong bảng `stores`
    await Store.updateMany(
      { foods: foodId },
      { $pull: { foods: foodId } } // Xóa món ăn khỏi mảng `foods` trong bảng `stores`
    );

    console.log("Món ăn đã được xóa:", deletedFood); // Log kiểm tra
    res.status(200).json({
      success: true,
      message: "Xóa món ăn thành công",
      data: deletedFood,
    });
  } catch (error) {
    console.error("Lỗi server:", error); // Log chi tiết lỗi server
    res.status(500).json({ message: "Lỗi server khi xóa món ăn", error });
  }
};

const getAllFoods = async (req, res) => {
  // const { page = 1, limit = 10, sortField = "foodName", sortOrder = "asc" } = req.query;

  try {
    // Tạo đối tượng sắp xếp, bao gồm sắp xếp theo isAvailable
    // const sortOptions = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    // Tìm tất cả món ăn, phân trang và sắp xếp
    const foods = await Food.find()
      .populate({
        path: "store",
        select: "storeName _id", // Lấy cả storeName và _id
      })
      .populate({
        path: "foodGroup",
        select: "groupName",
      });
    // .sort(sortOptions) // Sắp xếp theo sortOptions
    // .skip((page - 1) * limit) // Phân trang
    // .limit(limit); // Giới hạn số lượng kết quả

    if (!foods || foods.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy món ăn nào" });
    }

    // const totalItems = await Food.countDocuments();

    res.status(200).json({
      message: "Lấy tất cả món ăn thành công",
      foods: foods.map((food) => ({
        _id: food._id,
        foodName: food.foodName,
        price: food.price,
        description: food.description,
        store: food.store.storeName,
        storeId: food.store._id,
        imageUrl: food.imageUrl,
        foodGroup: food.foodGroup.groupName,
        isAvailable: food.isAvailable,
        isForSale: food.isForSale,
        discountedPrice: food.discountedPrice,
        isDiscounted: food.isDiscounted,
        sellingTime: food.sellingTime,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt,
      })),
      // totalPages: Math.ceil(totalItems / limit),
      // currentPage: page,
    });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách món ăn", error });
  }
};

const updateFoodAvailability = async (req, res) => {
  const { foodId } = req.params; // Lấy foodId từ params
  const { isAvailable } = req.body; // Lấy trạng thái mới từ body

  if (typeof isAvailable === "undefined") {
    return res.status(400).json({ message: "Thiếu dữ liệu isAvailable." });
  }

  try {
    // Tìm món ăn theo ID
    const food = await Food.findById(foodId);

    if (!food) {
      return res.status(404).json({ message: "Không tìm thấy món ăn." });
    }

    // Cập nhật trạng thái isAvailable
    food.isAvailable = isAvailable;

    // Lưu món ăn đã cập nhật vào MongoDB
    await food.save();

    return res.status(200).json({
      message: "Cập nhật trạng thái thành công.",
      food,
    });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái món ăn." });
  }
};

const getFoodWithCombo = async (req, res) => {
  try {
    const { foodId } = req.params;

    const food = await Food.findById(foodId).populate("foodGroup");
    if (!food) {
      return res.status(404).json({ message: "Không tìm thấy món ăn." });
    }

    const foodGroup = await FoodGroup.findById(food.foodGroup._id).populate("comboGroups");

    // Tạo cấu trúc dữ liệu theo nhóm combo
    const comboData = [];
    for (const comboGroup of foodGroup.comboGroups) {
      const foodsInComboGroup = await Food.find({ foodGroup: comboGroup._id });

      comboData.push({
        groupName: comboGroup.groupName, // Tên nhóm combo
        foods: foodsInComboGroup, // Danh sách món ăn thuộc nhóm combo
      });
    }

    return res.status(200).json({
      food,
      combos: comboData, // Trả về cấu trúc dữ liệu theo nhóm combo
    });
  } catch (error) {
    console.error("Error fetching food with combo:", error);
    res.status(500).json({ message: "Có lỗi xảy ra.", error: error.message });
  }
};

const addDiscountToFood = async (req, res) => {
  const { foodId } = req.params; // Lấy foodId từ params
  const { discountedPrice } = req.body; // Lấy discountedPrice từ body

  try {
    // Tìm món ăn theo ID
    const food = await Food.findById(foodId);

    if (!food) {
      return res.status(404).json({ message: "Không tìm thấy món ăn." });
    }

    // Kiểm tra tính hợp lệ của giá giảm
    if (typeof discountedPrice !== "number" || discountedPrice <= 0) {
      return res.status(400).json({ message: "Giá giảm không hợp lệ." });
    }

    if (discountedPrice >= food.price) {
      return res.status(400).json({ message: "Giá giảm phải nhỏ hơn giá gốc của món ăn." });
    }

    // Cập nhật giá giảm cho món ăn
    food.discountedPrice = discountedPrice;

    // Lưu món ăn đã cập nhật vào MongoDB
    await food.save();

    return res.status(200).json({
      message: "Thêm giảm giá cho món ăn thành công.",
      food,
    });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi thêm giảm giá cho món ăn." });
  }
};

const toggleDiscountAcceptance = async (req, res) => {
  const { foodId } = req.params; // Lấy foodId từ params
  const { isDiscounted } = req.body; // Lấy trạng thái isDiscounted từ body

  try {
    // Tìm món ăn theo ID
    const food = await Food.findById(foodId);

    if (!food) {
      return res.status(404).json({ message: "Không tìm thấy món ăn." });
    }

    if (typeof isDiscounted !== "boolean") {
      return res.status(400).json({ message: "Trạng thái giảm giá không hợp lệ." });
    }

    if (isDiscounted && !food.discountedPrice) {
      return res.status(400).json({ message: "Không thể áp dụng giảm giá. Vui lòng thêm giá giảm trước." });
    }

    // Cập nhật trạng thái giảm giá
    food.isDiscounted = isDiscounted;

    // Lưu món ăn đã cập nhật vào MongoDB
    await food.save();

    return res.status(200).json({
      message: isDiscounted ? "Áp dụng giảm giá thành công." : "Hủy áp dụng giảm giá thành công.",
      food,
    });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật giảm giá.", error });
  }
};

const searchFoods = async (req, res) => {
  try {
    const { foodName, storeId } = req.query;

    const query = {};

    if (foodName) {
      query.foodName = { $regex: foodName, $options: "i" }; // Tìm kiếm không phân biệt hoa thường
    }

    if (storeId) {
      query.store = storeId; // Chỉ tìm món ăn thuộc cửa hàng hiện tại
    }

    const foods = await Food.find(query).populate("store", "storeName").populate("foodGroup", "groupName");

    if (!foods.length) {
      return res.status(200).json({ success: true, data: [], msg: "Không tìm thấy món ăn nào." });
    }

    return res.status(200).json({ success: true, data: foods });
  } catch (error) {
    console.error("Lỗi tìm kiếm món ăn:", error.message);
    return res.status(500).json({ success: false, msg: "Lỗi máy chủ.", error: error.message });
  }
};

module.exports = {
  addFoodItem,
  getFoodById,
  getFoodsByStoreId,
  deleteFoodItem,
  getAllFoods,
  updateFoodItem,
  updateFoodAvailability,
  getFoodWithCombo,
  addDiscountToFood,
  toggleDiscountAcceptance,
  searchFoods,
};
