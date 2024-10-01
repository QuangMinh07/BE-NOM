const Cart = require("../models/cart");
const Food = require("../models/food");

// Hàm thêm món ăn vào giỏ hàng mà không yêu cầu địa chỉ giao hàng
const addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { foodId, quantity } = req.body; // Chỉ cần foodId và quantity lúc thêm món

    // Tìm món ăn theo foodId
    const food = await Food.findById(foodId).populate("store");
    if (!food) {
      return res.status(404).json({ message: "Món ăn không tồn tại" });
    }

    // Tìm hoặc tạo giỏ hàng của người dùng
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], totalPrice: 0 });
    }

    // Thêm món ăn vào giỏ hàng
    const existingItemIndex = cart.items.findIndex((item) => item.food.toString() === foodId);
    if (existingItemIndex !== -1) {
      // Nếu món ăn đã có trong giỏ, tăng số lượng
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = cart.items[existingItemIndex].quantity * food.price;
    } else {
      // Nếu món ăn chưa có trong giỏ, thêm mới
      cart.items.push({
        food: food._id,
        store: food.store._id, // Liên kết cửa hàng với món ăn
        quantity,
        price: food.price * quantity,
      });
    }

    // Cập nhật tổng số tiền
    cart.totalPrice = cart.items.reduce((total, item) => total + item.price, 0);

    // Lưu lại giỏ hàng
    await cart.save();

    res.status(200).json({ message: "Thêm vào giỏ hàng thành công!", cart });
  } catch (error) {
    console.error("Lỗi khi thêm vào giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi thêm vào giỏ hàng", error });
  }
};

// Hàm cập nhật địa chỉ giao hàng và thanh toán
const checkout = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deliveryAddress } = req.body;

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Cập nhật địa chỉ giao hàng
    cart.deliveryAddress = deliveryAddress;

    // Xoá giỏ hàng sau khi thanh toán thành công
    await cart.save(); // Lưu lại địa chỉ trước khi xoá

    res.status(200).json({ message: "Thanh toán thành công!", cart });
  } catch (error) {
    console.error("Lỗi khi thanh toán:", error);
    res.status(500).json({ message: "Lỗi khi thanh toán", error });
  }
};

const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.food", // Lấy thông tin từ mô hình Food
      select: "foodName price", // Chỉ lấy tên món ăn và giá
    });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Tạo phản hồi chứa thông tin giỏ hàng
    const cartDetails = cart.items.map((item) => ({
      foodName: item.food.foodName,
      price: item.food.price,
      quantity: item.quantity,
      totalItemPrice: item.price,
    }));

    // Gửi phản hồi chứa thông tin giỏ hàng
    res.status(200).json({
      message: "Lấy thông tin giỏ hàng thành công!",
      cart: {
        totalPrice: cart.totalPrice,
        items: cartDetails,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin giỏ hàng", error });
  }
};

module.exports = {
  addToCart,
  checkout,
  getCart,
};
