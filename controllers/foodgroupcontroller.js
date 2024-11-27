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

const deleteFoodGroup = async (req, res) => {
  try {
    const { groupId } = req.params; // Lấy groupId từ params

    // Kiểm tra nếu groupId không tồn tại
    if (!groupId) {
      return res.status(400).json({ message: "ID nhóm món không được để trống." });
    }

    // Tìm nhóm món để kiểm tra xem có tồn tại không
    const foodGroup = await FoodGroup.findById(groupId);

    if (!foodGroup) {
      return res.status(404).json({ message: "Không tìm thấy nhóm món." });
    }

    // Xóa các món ăn thuộc nhóm món này
    await Food.deleteMany({ _id: { $in: foodGroup.foods } });

    // Xóa nhóm món
    await FoodGroup.findByIdAndDelete(groupId);

    // Xóa nhóm món khỏi danh sách nhóm món của cửa hàng
    await Store.findByIdAndUpdate(foodGroup.store, {
      $pull: { foodGroups: groupId },
    });

    return res.status(200).json({
      message: "Xóa nhóm món và các món ăn liên quan thành công.",
    });
  } catch (error) {
    // Xử lý lỗi
    console.error("Error deleting food group:", error);
    return res.status(500).json({
      message: "Có lỗi xảy ra khi xóa nhóm món.",
      error: error.message,
    });
  }
};

const updateFoodGroupName = async (req, res) => {
  try {
    const { groupId } = req.params; // Lấy groupId từ params
    const { groupName } = req.body; // Lấy groupName từ body

    // Kiểm tra nếu groupId hoặc groupName không tồn tại
    if (!groupId || !groupName) {
      return res.status(400).json({ message: "ID nhóm món và tên nhóm món không được để trống." });
    }

    // Tìm nhóm món để cập nhật
    const foodGroup = await FoodGroup.findById(groupId);

    if (!foodGroup) {
      return res.status(404).json({ message: "Không tìm thấy nhóm món." });
    }

    // Cập nhật tên nhóm món
    foodGroup.groupName = groupName;
    const updatedFoodGroup = await foodGroup.save();

    return res.status(200).json({
      message: "Cập nhật tên nhóm món thành công.",
      foodGroup: updatedFoodGroup,
    });
  } catch (error) {
    console.error("Error updating food group name:", error);
    return res.status(500).json({
      message: "Có lỗi xảy ra khi cập nhật tên nhóm món.",
      error: error.message,
    });
  }
};

const addComboToFoodGroup = async (req, res) => {
  try {
    const { groupId } = req.params; // Lấy ID nhóm món cần ghép combo
    const { comboGroupIds } = req.body; // Lấy danh sách ID nhóm món cần ghép từ body

    // Kiểm tra dữ liệu đầu vào
    if (!groupId || !comboGroupIds || !Array.isArray(comboGroupIds)) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra groupId và comboGroupIds." });
    }

    // Tìm nhóm món chính
    const mainGroup = await FoodGroup.findById(groupId);

    if (!mainGroup) {
      return res.status(404).json({ message: "Không tìm thấy nhóm món chính." });
    }

    // Kiểm tra và thêm comboGroupIds vào danh sách comboGroups
    const validComboGroups = await FoodGroup.find({ _id: { $in: comboGroupIds } });

    if (!validComboGroups.length) {
      return res.status(404).json({ message: "Không tìm thấy nhóm món để ghép." });
    }

    // Xử lý ghi đè hoặc thêm mới comboGroups
    const updatedComboGroups = validComboGroups.reduce(
      (result, comboGroup) => {
        // Kiểm tra nếu comboGroup đã tồn tại
        const existingIndex = result.findIndex((group) => group.equals(comboGroup._id));
        if (existingIndex !== -1) {
          // Ghi đè thông tin nhóm món đã tồn tại
          result[existingIndex] = comboGroup._id;
        } else {
          // Thêm nhóm mới
          result.push(comboGroup._id);
        }
        return result;
      },
      [...mainGroup.comboGroups]
    ); // Khởi tạo với danh sách hiện tại

    // Cập nhật danh sách comboGroups
    mainGroup.comboGroups = updatedComboGroups;

    // Lưu nhóm món đã cập nhật
    const updatedGroup = await mainGroup.save();

    return res.status(200).json({
      message: "Ghép nhóm món thành công.",
      foodGroup: updatedGroup,
    });
  } catch (error) {
    console.error("Error adding combo to food group:", error);
    return res.status(500).json({
      message: "Có lỗi xảy ra khi ghép nhóm món.",
      error: error.message,
    });
  }
};

const removeComboFromFoodGroup = async (req, res) => {
  try {
    const { groupId } = req.params; // Lấy ID nhóm món chính
    const { comboGroupId } = req.body; // Lấy ID nhóm món combo cần xóa từ body
    console.log("Request Params:", req.params);
    console.log("Request Body:", req.body);
    // Kiểm tra dữ liệu đầu vào
    if (!groupId || !comboGroupId) {
      return res.status(400).json({ message: "Dữ liệu không hợp lệ. Vui lòng kiểm tra groupId và comboGroupId." });
    }

    // Tìm nhóm món chính
    const mainGroup = await FoodGroup.findById(groupId);

    if (!mainGroup) {
      return res.status(404).json({ message: "Không tìm thấy nhóm món chính." });
    }

    // Xóa comboGroupId khỏi danh sách comboGroups
    const index = mainGroup.comboGroups.indexOf(comboGroupId);
    if (index === -1) {
      return res.status(404).json({ message: "Nhóm món combo không tồn tại trong danh sách." });
    }

    mainGroup.comboGroups.splice(index, 1); // Xóa comboGroupId khỏi danh sách comboGroups

    // Lưu nhóm món đã cập nhật
    const updatedGroup = await mainGroup.save();

    return res.status(200).json({
      message: "Xóa nhóm món combo thành công.",
      foodGroup: updatedGroup,
    });
  } catch (error) {
    console.error("Error removing combo from food group:", error);
    return res.status(500).json({
      message: "Có lỗi xảy ra khi xóa nhóm món combo.",
      error: error.message,
    });
  }
};

module.exports = { addFoodGroup, getFoodGroups, getFoodGroupByFoodIdAndStoreId, deleteFoodGroup, updateFoodGroupName, addComboToFoodGroup, removeComboFromFoodGroup };
