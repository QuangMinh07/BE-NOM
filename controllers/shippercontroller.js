const ShipperInfo = require("../models/shipper");

const getShipperInfo = async (req, res) => {
  try {
    const { userId } = req.params; // Lấy userId từ params

    // Tìm thông tin Shipper dựa trên userId
    const shipperInfo = await ShipperInfo.findOne({ userId }).populate({
      path: "personalInfoId",
      model: "UserPersonalInfo",
      select: "profilePictureURL dateOfBirth", // Chọn các trường cần từ UserPersonalInfo
    });

    if (!shipperInfo) {
      return res.status(404).json({ message: "Không tìm thấy thông tin shipper" });
    }

    // Trả về thông tin chi tiết shipper
    res.status(200).json({
      success: true,
      data: {
        _id: shipperInfo._id,
        userId: shipperInfo.userId,
        personalInfoId: shipperInfo.personalInfoId,
        temporaryAddress: shipperInfo.temporaryAddress,
        bankAccount: shipperInfo.bankAccount,
        vehicleNumber: shipperInfo.vehicleNumber,
        createdAt: shipperInfo.createdAt,
        updatedAt: shipperInfo.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin shipper:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin shipper", error });
  }
};

module.exports = {
  getShipperInfo,
};
