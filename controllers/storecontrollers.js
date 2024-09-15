const Store = require("../models/store");

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

module.exports = {
  getStoreByUser,
};
