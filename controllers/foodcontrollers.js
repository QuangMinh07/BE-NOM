const Food = require("../models/food");
const Store = require("../models/store");
const FoodGroup = require("../models/foodgroup"); // Import model FoodGroup

const addFoodItem = async (req, res) => {
  const { storeId, foodName, price, description, imageUrl, foodGroup, isAvailable, sellingTime } = req.body;

  try {
    console.log("Store ID từ client:", storeId); // Log giá trị storeId

    const store = await Store.findById(storeId); // Truy vấn MongoDB

    if (!store) {
      console.log("Không tìm thấy cửa hàng với storeId:", storeId); // Log nếu không tìm thấy
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Chuyển đổi sellingTime từ frontend sang định dạng MongoDB
    const formattedSellingTime = sellingTime.map((dayData) => {
      if (dayData.is24h) {
        return {
          day: dayData.day,
          is24h: true,
          timeSlots: [
            {
              open: "00:00", // Giờ mở bán là từ nửa đêm
              close: "23:59", // Giờ đóng bán là đến hết ngày
            },
          ], // Thêm timeSlots với thời gian bán nguyên ngày
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

    // Tạo món ăn mới
    const newFood = new Food({
      foodName,
      price,
      description,
      store: storeId, // Liên kết với cửa hàng
      imageUrl,
      foodGroup,
      isAvailable,
      sellingTime: formattedSellingTime, // Lưu formattedSellingTime
    });

    // Lưu món ăn mới vào MongoDB
    await newFood.save();

    // Thêm foodId vào danh sách món ăn của cửa hàng
    store.foods = store.foods ? [...store.foods, newFood._id] : [newFood._id];

    // Lưu cập nhật cửa hàng sau khi thêm foodId
    await store.save();

    // Cập nhật danh sách món ăn trong FoodGroup
    const foodGroupRecord = await FoodGroup.findById(foodGroup);
    if (foodGroupRecord) {
      foodGroupRecord.foods.push(newFood._id); // Thêm foodId vào danh sách foods của FoodGroup
      await foodGroupRecord.save(); // Lưu cập nhật FoodGroup
    } else {
      console.log("Không tìm thấy nhóm món với id:", foodGroup);
      return res.status(404).json({ message: "Nhóm món không tồn tại" });
    }

    // Trả về phản hồi thành công sau khi lưu thành công món ăn và cập nhật FoodGroup
    return res.status(200).json({ message: "Thêm món ăn thành công", food: newFood });
  } catch (error) {
    console.error("Lỗi server:", error);
    // Trả về phản hồi lỗi nếu có lỗi xảy ra
    return res.status(500).json({ message: "Lỗi server khi thêm món ăn" });
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

const updateFoodAvailability = async (req, res) => {
  const { foodId } = req.params; // Lấy id từ params của request
  const { isForSale } = req.body; // Lấy isForSale từ body của request

  try {
    // Tìm món ăn theo id
    const food = await Food.findById(foodId);

    // Nếu món ăn không tồn tại, trả về lỗi
    if (!food) {
      return res.status(404).json({ message: "Món ăn không tồn tại" });
    }

    // Kiểm tra nếu store là chuỗi rỗng hoặc không hợp lệ
    if (!food.store || food.store === "") {
      return res.status(400).json({ message: "Cửa hàng của món ăn không hợp lệ" });
    }
    food.isForSale = isForSale;

    // Lưu lại trạng thái mới sau khi cập nhật
    const updatedFood = await food.save();

    // Trả về món ăn đã được cập nhật
    return res.status(200).json(updatedFood);
  } catch (error) {
    // Xử lý lỗi và trả về lỗi 500
    return res.status(500).json({ message: "Có lỗi xảy ra", error });
  }
};

const deleteFoodItem = async (req, res) => {
  const { foodId } = req.params;

  try {
    const deletedFood = await Food.findByIdAndDelete(foodId);

    if (!deletedFood) {
      return res.status(404).json({ message: "Không tìm thấy món ăn" });
    }

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

module.exports = {
  addFoodItem,
  getFoodById,
  getFoodsByStoreId,
  updateFoodAvailability,
  deleteFoodItem,
};
