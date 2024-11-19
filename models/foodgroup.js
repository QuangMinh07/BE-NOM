const mongoose = require("mongoose");

const FoodGroupSchema = new mongoose.Schema({
  groupName: {
    type: String,
    required: true,
    trim: true,
  },
  foods: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food", // Liên kết với các món ăn thuộc nhóm
    },
  ],
  store: {
    type: mongoose.Schema.Types.ObjectId, // Liên kết với cửa hàng mà nhóm món thuộc về
    ref: "Store",
    required: true,
  },
  comboGroups: [
    {
      type: mongoose.Schema.Types.ObjectId, // Lưu danh sách các nhóm món được ghép
      ref: "FoodGroup",
    },
  ],
});

const FoodGroup = mongoose.model("FoodGroup", FoodGroupSchema);

module.exports = FoodGroup;
