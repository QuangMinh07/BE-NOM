const ShipperInfo = require("../models/shipper");
const Order = require("../models/storeOrder");

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

const getDeliveredOrdersByShipper = async (req, res) => {
  try {
    const { shipperId } = req.params; // Lấy shipperId từ params

    // Lấy danh sách đơn hàng với trạng thái Delivered và shipperId
    const deliveredOrders = await Order.find({
      shipper: shipperId, // Sử dụng trường shipper trong đơn hàng
      orderStatus: "Delivered",
    })
      .populate("store", "storeName storeAddress") // Populate thông tin cửa hàng
      .populate("user", "fullName email") // Populate thông tin khách hàng
      .sort({ deliveredDate: -1 }); // Sắp xếp theo ngày giao hàng mới nhất

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào đã giao" });
    }

    // Trả về danh sách đơn hàng
    res.status(200).json({
      success: true,
      data: deliveredOrders,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đơn hàng đã giao:", error);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đơn hàng đã giao", error });
  }
};

module.exports = {
  getShipperInfo,
  getDeliveredOrdersByShipper,
};
