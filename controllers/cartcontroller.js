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
    const { deliveryAddress, receiverName, receiverPhone, description } = req.body; // Nhận thông tin từ body

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Cập nhật thông tin giao hàng
    cart.deliveryAddress = deliveryAddress;
    cart.receiverName = receiverName;
    cart.receiverPhone = receiverPhone;
    cart.description = description;

    // Lưu lại giỏ hàng với thông tin đã cập nhật
    await cart.save();

    // Cập nhật thành công địa chỉ giao hàng
    res.status(200).json({ message: "Cập nhật địa chỉ giao hàng thành công!", cart });
  } catch (error) {
    console.error("Lỗi khi cập nhật địa chỉ:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật địa chỉ", error });
  }
};

const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm giỏ hàng của người dùng và populate thông tin món ăn từ mô hình Food
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.food", // Tham chiếu đến mô hình Food dựa trên foodId
      select: "foodName price", // Chỉ lấy các trường cần thiết là foodName và price
    });

    console.log("Cart Data:", cart); // Log dữ liệu giỏ hàng để kiểm tra

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Tạo phản hồi chứa thông tin giỏ hàng
    const cartDetails = cart.items
      .map((item) => {
        // Kiểm tra nếu món ăn tồn tại trong dữ liệu đã populate
        if (item.food) {
          return {
            foodId: item.food._id, // Trả về ID món ăn
            foodName: item.food.foodName, // Tên món ăn từ Food model
            price: item.food.price, // Giá món ăn từ Food model
            quantity: item.quantity, // Số lượng món ăn trong giỏ
            totalItemPrice: item.quantity * item.food.price, // Tính tổng giá của món ăn trong giỏ
          };
        }
        console.warn("Không tìm thấy món ăn cho ID:", item.food); // Cảnh báo nếu không có thông tin món ăn
        return null; // Trả về null nếu không có thông tin món ăn
      })
      .filter((item) => item !== null); // Lọc các phần tử null ra khỏi mảng

    // Gửi phản hồi chứa thông tin giỏ hàng
    res.status(200).json({
      message: "Lấy thông tin giỏ hàng thành công!",
      cart: {
        _id: cart._id, // Thêm _id của giỏ hàng
        totalPrice: cart.totalPrice, // Tổng tiền của giỏ hàng
        items: cartDetails, // Danh sách các món ăn
        deliveryAddress: cart.deliveryAddress, // Địa chỉ giao hàng
        receiverName: cart.receiverName, // Tên người nhận
        receiverPhone: cart.receiverPhone, // Số điện thoại người nhận
        description: cart.description, // Mô tả thêm nếu có
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin giỏ hàng", error });
  }
};

const updateShippingInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deliveryAddress, receiverName, receiverPhone, description } = req.body;

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Cập nhật thông tin giao hàng
    cart.deliveryAddress = deliveryAddress || cart.deliveryAddress;
    cart.receiverName = receiverName || cart.receiverName;
    cart.receiverPhone = receiverPhone || cart.receiverPhone;

    // Cập nhật mô tả - chấp nhận chuỗi rỗng (""), nhưng không phải là undefined
    if (description !== undefined) {
      cart.description = description; // Chấp nhận cả chuỗi rỗng để ghi đè
    }

    // Lưu lại giỏ hàng với thông tin đã cập nhật
    await cart.save();

    // Cập nhật thành công địa chỉ giao hàng
    res.status(200).json({
      message: "Cập nhật thông tin giao hàng thành công!",
      cart: {
        deliveryAddress: cart.deliveryAddress,
        receiverName: cart.receiverName,
        receiverPhone: cart.receiverPhone,
        description: cart.description,
      },
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin giao hàng:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật thông tin giao hàng", error });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { userId, foodId } = req.params; // Lấy đúng foodId từ params

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Tìm món ăn theo foodId
    const itemIndex = cart.items.findIndex((item) => item.food.toString() === foodId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Món ăn không tồn tại trong giỏ hàng" });
    }

    // Xóa món ăn khỏi giỏ hàng
    cart.items.splice(itemIndex, 1);

    // Cập nhật tổng giá tiền
    cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0);

    // Lưu giỏ hàng sau khi xóa
    await cart.save();

    res.status(200).json({
      message: "Xóa món ăn khỏi giỏ hàng thành công!",
      cart,
    });
  } catch (error) {
    console.error("Lỗi khi xóa món ăn khỏi giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi xóa món ăn khỏi giỏ hàng", error });
  }
};

module.exports = {
  addToCart,
  checkout,
  getCart,
  updateShippingInfo,
  removeFromCart,
};
