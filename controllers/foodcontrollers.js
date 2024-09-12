const Food = require("../models/food");
const Store = require("../models/store");

const addFoodItem = async (req, res) => {
  const {
    storeId,
    foodName,
    price,
    description,
    imageUrl,
    foodGroup,
    isAvailable,
    sellingTime,
  } = req.body;

  try {
    // Tìm kiếm cửa hàng dựa trên storeId
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Tạo món ăn mới
    const newFood = new Food({
      foodName,
      price,
      description,
      store: storeId, // Liên kết với cửa hàng
      imageUrl,
      foodGroup,
      isAvailable,
      sellingTime,
    });

    // Lưu món ăn
    await newFood.save();

    res.status(200).json({ message: "Thêm món ăn thành công", food: newFood });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = {
  addFoodItem,
};
