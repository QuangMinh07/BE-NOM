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
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    const reviews = await OrderReview.find({ store: storeId })
      .populate({
        path: "user",
        select: "fullName email",
      })
      .populate({
        path: "order",
        select: "orderDate totalAmount cartSnapshot items combos",
      })
      .populate({
        path: "replies.user", // Populate thông tin người trả lời
        select: "fullName email",
      })
      .sort({ reviewDate: -1 });

    const reviewData = reviews.map((review) => {
      const { user, rating, comment, reviewDate, order, replies } = review;

      if (!order) {
        console.log(`Order không tồn tại cho review: ${review._id}`);
        return {
          _id: review._id,
          user: user?.fullName || "Ẩn danh",
          rating,
          comment,
          reviewDate,
          orderDate: null,
          totalAmount: null,
          orderedFoods: [],
          replies: [],
        };
      }

      // Lấy danh sách món ăn từ items
      const orderedFoods =
        order?.cartSnapshot?.items?.map((item) => ({
          foodName: item.foodName,
          quantity: item.quantity,
          price: item.price,
        })) || [];

      // Lấy danh sách món ăn từ combos
      const comboFoods =
        order?.cartSnapshot?.combos?.foods?.map((comboFood) => ({
          foodName: comboFood.foodName,
          price: comboFood.price,
          quantity: order.cartSnapshot?.combos?.totalQuantity || 1,
        })) || [];

      // Gộp tất cả món ăn
      const allOrderedFoods = [...orderedFoods, ...comboFoods];

      // Xử lý replies
      const formattedReplies =
        replies?.map((reply) => ({
          _id: reply._id,
          replyText: reply.replyText,
          replyDate: reply.replyDate,
          user: reply.user?.fullName || "Ẩn danh",
        })) || [];

      return {
        _id: review._id,
        user: user?.fullName || "Ẩn danh",
        rating,
        comment,
        reviewDate,
        orderDate: order?.orderDate,
        totalAmount: order?.totalAmount,
        orderedFoods: allOrderedFoods,
        replies: formattedReplies, // Thêm replies vào phản hồi
      };
    });

    res.status(200).json({
      message: "Lấy danh sách đánh giá thành công",
      reviews: reviewData,
    });
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

// Hàm thêm phản hồi
const addReplyToReview = async (req, res) => {
  const { reviewId } = req.params;
  const { replyText, userId } = req.body;

  console.log("Received data:", req.body);
  console.log("Review ID:", req.params.reviewId);

  if (!replyText || !userId) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin phản hồi hoặc người trả lời." });
  }

  try {
    // Tìm bình luận cần trả lời
    const review = await OrderReview.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bình luận." });
    }

    // Thêm phản hồi vào bình luận
    review.replies.push({
      user: userId,
      replyText: replyText,
    });

    // Lưu lại
    await review.save();

    res.status(200).json({
      success: true,
      message: "Phản hồi đã được thêm thành công.",
      review,
    });
  } catch (error) {
    console.error("Lỗi khi thêm phản hồi:", error);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
};

module.exports = { rateOrderAndStore, getStoreReviews, checkOrderReview, addReplyToReview };
