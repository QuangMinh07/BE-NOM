const OrderReview = require("../models/orderReview");
const Store = require("../models/store");
const StoreOrder = require("../models/storeOrder");

const rateOrderAndStore = async (req, res) => {
  const { orderId, userId, rating, comment } = req.body;

  try {
    // Kiểm tra đơn hàng tồn tại
    const order = await StoreOrder.findById(orderId).populate("store");
    if (!order) {
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }

    // Kiểm tra cửa hàng tồn tại
    const store = order.store;
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Tạo đánh giá đơn hàng
    const orderReview = new OrderReview({
      order: orderId,
      user: userId,
      store: store._id,
      rating,
      comment,
    });

    await orderReview.save();

    // Tính lại sao trung bình cho cửa hàng
    const reviews = await OrderReview.find({ store: store._id });
    const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    // Cập nhật sao trung bình của cửa hàng
    store.averageRating = averageRating.toFixed(1);
    await store.save();

    res.status(201).json({
      message: "Đánh giá đơn hàng và cửa hàng thành công",
      orderReview,
      storeAverageRating: store.averageRating,
    });
  } catch (error) {
    console.error("Lỗi khi đánh giá đơn hàng:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getStoreReviews = async (req, res) => {
  const { storeId } = req.params;

  try {
    // Kiểm tra xem cửa hàng có tồn tại không
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Lấy danh sách đánh giá của cửa hàng từ OrderReview
    const reviews = await OrderReview.find({ store: storeId })
      .populate({
        path: "user",
        select: "fullName email", // Hiển thị thông tin người đánh giá
      })
      .populate({
        path: "order",
        select: "orderDate totalAmount", // Hiển thị thông tin đơn hàng liên quan
      })
      .sort({ reviewDate: -1 }); // Sắp xếp đánh giá từ mới nhất đến cũ nhất

    res.status(200).json({ message: "Lấy danh sách đánh giá thành công", reviews });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đánh giá:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const checkOrderReview = async (req, res) => {
  const { orderId } = req.params;

  try {
    const review = await OrderReview.findOne({ order: orderId });
    res.status(200).json({ exists: !!review });
  } catch (error) {
    console.error("Error checking OrderReview:", error);
    res.status(500).json({ message: "Error checking OrderReview" });
  }
};

module.exports = { rateOrderAndStore, getStoreReviews, checkOrderReview };
