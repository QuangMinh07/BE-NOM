const FoodGroup = require("../models/foodgroup"); // Import model FoodGroup
const Store = require("../models/store"); // Import model Store
const Food = require("../models/food"); // Đảm bảo đường dẫn tới file mô hình Food là chính xác

const addFoodGroup = async (req, res) => {
  try {
    const { groupName } = req.body;
    const { storeId } = req.params;

    // Log dữ liệu để kiểm tra
    console.log("Received groupName:", groupName);
    console.log("Received storeId:", storeId);

    // Kiểm tra nếu tên nhóm món hoặc ID cửa hàng trống
    if (!groupName || !storeId) {
      return res.status(400).json({ message: "Tên nhóm món và ID cửa hàng không được để trống." });
    }

    // Tìm cửa hàng theo storeId
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng." });
    }

    // Tạo nhóm món mới
    const newFoodGroup = new FoodGroup({
      groupName,
      store: storeId,
    });

    // Lưu nhóm món mới vào DB
    const savedFoodGroup = await newFoodGroup.save();

    // Thêm nhóm món vào danh sách nhóm món của cửa hàng
    store.foodGroups.push(savedFoodGroup._id);
    await store.save();

    // Trả về phản hồi thành công với status 201 (đã tạo)
    return res.status(201).json({
      message: "Thêm nhóm món thành công.",
      foodGroup: savedFoodGroup,
    });
  } catch (error) {
    // Log lỗi chi tiết để dễ dàng kiểm tra
    console.error("Error adding food group:", error);
    return res.status(500).json({
      message: "Có lỗi xảy ra khi thêm nhóm món.",
      error: error.message,
    });
  }
};

// Hàm lấy danh sách nhóm món theo storeId
const getFoodGroups = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params

    // Kiểm tra nếu storeId không tồn tại
    if (!storeId) {
      return res.status(400).json({ message: "ID cửa hàng không được để trống." });
    }

    // Lấy danh sách món ăn và nhóm món, đồng thời populate foodGroup
    const foods = await Food.find({ store: storeId }).populate("foodGroup", "groupName"); // Populate để lấy đầy đủ thông tin groupName từ foodGroup

    const foodGroups = await FoodGroup.find({ store: storeId }); // Lấy nhóm món

    // Trả về kết quả với foods đã populate đầy đủ thông tin groupName từ foodGroup
    return res.status(200).json({
      message: "Danh sách nhóm món và món ăn",
      foods, // Danh sách món ăn đã có groupName
      foodGroups, // Danh sách nhóm món
    });
  } catch (error) {
    return res.status(500).json({
      message: "Có lỗi xảy ra.",
      error: error.message,
    });
  }
};

const getFoodGroupByFoodIdAndStoreId = async (req, res) => {
  try {
    const { storeId, foodId } = req.params;

    // Kiểm tra nếu storeId hoặc foodId không tồn tại
    if (!storeId || !foodId) {
      return res.status(400).json({ message: "ID cửa hàng và ID món ăn không được để trống." });
    }

    // Tìm món ăn dựa trên foodId và storeId, đồng thời populate thông tin groupName từ foodGroup
    const food = await Food.findOne({ _id: foodId, store: storeId }).populate("foodGroup", "groupName");

    // Kiểm tra nếu món ăn không tồn tại
    if (!food) {
      return res.status(404).json({ message: "Không tìm thấy món ăn trong cửa hàng này." });
    }

    // Trả về thông tin nhóm món (groupName) từ foodGroup của món ăn
    return res.status(200).json({
      message: "Thông tin nhóm món ăn",
      groupName: food.foodGroup.groupName, // Trả về tên nhóm món từ foodGroup
      foodDetails: food, // Trả về chi tiết món ăn nếu cần
    });
  } catch (error) {
    return res.status(500).json({
      message: "Có lỗi xảy ra.",
      error: error.message,
    });
  }
};

module.exports = { addFoodGroup, getFoodGroups, getFoodGroupByFoodIdAndStoreId };
