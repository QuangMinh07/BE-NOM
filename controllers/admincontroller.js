const Admin = require("../models/admin");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Store = require("../models/store");
const ShipperInfo = require("../models/shipper");
const UserPersonalInfo = require("../models/userPersonal");
const StoreOrder = require("../models/storeOrder");
const Food = require("../models/food");
const nodemailer = require("nodemailer");

const registerAdmin = async (req, res, next) => {
  const { username, fullName, password } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!username || !fullName || !password) {
    return next(errorHandler(400, "Cả tên người dùng, tên đầy đủ và mật khẩu đều phải nhập"));
  }

  // Kiểm tra độ dài username
  if (username.length < 7 || username.length > 20) {
    return next(errorHandler(400, "Tên người dùng phải có từ 7 đến 20 ký tự"));
  }

  // Kiểm tra độ dài password
  if (password.length < 8) {
    return next(errorHandler(400, "Mật khẩu phải có ít nhất 8 ký tự"));
  }

  try {
    // Kiểm tra xem username đã tồn tại chưa
    const existingAdmin = await Admin.findOne({ userName: username });

    if (existingAdmin) {
      return next(errorHandler(400, "Tên người dùng đã tồn tại"));
    }

    // Mã hóa mật khẩu
    const hashedPassword = bcryptjs.hashSync(password, 10);

    // Tạo Admin mới
    const newAdmin = new Admin({
      userName: username,
      fullName,
      password: hashedPassword,
    });

    // Lưu Admin vào cơ sở dữ liệu
    await newAdmin.save();

    // Trả về phản hồi thành công
    res.status(201).json({
      success: true,
      message: "Đăng ký Admin thành công!",
    });
  } catch (error) {
    next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  const { username, password } = req.body;

  // Kiểm tra xem username và password có được nhập hay không
  if (!username || !password) {
    return next(errorHandler(400, "Vui lòng nhập cả tên người dùng và mật khẩu"));
  }

  try {
    // Tìm admin với username đã cung cấp
    const admin = await Admin.findOne({ userName: username });

    // Kiểm tra xem admin có tồn tại không
    if (!admin) {
      return next(errorHandler(400, "Tên người dùng không chính xác"));
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcryptjs.compare(password, admin.password);
    if (!isMatch) {
      return next(errorHandler(400, "Mật khẩu không chính xác"));
    }

    // Tạo token xác thực
    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
        username: admin.userName,
        fullName: admin.fullName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Thời gian tồn tại token là 7 ngày
    );

    // Lưu token vào cookie
    res.cookie("accessToken", token, {
      httpOnly: true, // Đảm bảo cookie chỉ được sử dụng trong HTTP, không thể truy cập từ JavaScript
      secure: false, // Đảm bảo cookie chỉ được gửi qua HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (tính bằng milliseconds)
    });

    // Trả về phản hồi đăng nhập thành công
    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
      admin: {
        id: admin._id,
        userName: admin.userName,
        fullName: admin.fullName, // Trả về fullName
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAllUser = async (req, res) => {
  try {
    const {
      sortField = "userName", // Mặc định sắp xếp theo tên
      sortOrder = "asc", // Mặc định sắp xếp tăng dần (A -> Z)
      role, // Lọc theo vai trò customer, seller, shipper
      isOnline, // Lọc theo trạng thái online hoặc offline
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lọc người dùng theo vai trò nếu có truyền
    const query = role ? { roleId: role } : { roleId: { $in: ["customer", "seller", "shipper"] } };

    // Nếu có truyền isOnline, thêm điều kiện lọc online hoặc offline
    if (typeof isOnline !== "undefined") {
      query.isOnline = isOnline === "true"; // Chuyển giá trị isOnline từ string thành Boolean
    }

    // Tạo đối tượng sắp xếp
    const sortOptions = {};
    if (sortField && sortOrder) {
      sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;
    }

    // Lấy danh sách người dùng theo sắp xếp và phân trang, đồng thời populate storeIds
    let users = await User.find(query).sort(sortOptions).skip(skip).limit(limit).populate({
      path: "storeIds",
      model: "Store",
      select: "storeName storeAddress bankAccount foodType createdAt", // Lấy các trường từ Store
    });

    // Nếu roleId là shipper thì populate thêm ShipperInfo
    users = await Promise.all(
      users.map(async (user) => {
        if (user.roleId === "shipper") {
          const shipperInfo = await ShipperInfo.findOne({ userId: user._id });
          return {
            ...user.toObject(),
            shipperInfo: shipperInfo
              ? {
                  vehicleNumber: shipperInfo.vehicleNumber,
                  temporaryAddress: shipperInfo.temporaryAddress,
                  bankAccount: shipperInfo.bankAccount,
                }
              : null,
          };
        }
        return user;
      })
    );

    const totalUsers = await User.countDocuments(query);

    if (users.length === 0) {
      return res.status(404).json({ success: false, msg: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      success: true,
      data: users,
      total: totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ success: false, msg: "Lỗi server" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const {
      sortField = "userName", // Mặc định sắp xếp theo tên
      sortOrder = "asc", // Mặc định sắp xếp tăng dần (A -> Z)
      role, // Lọc theo vai trò customer, seller, shipper
      isOnline, // Lọc theo trạng thái online hoặc offline
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lọc người dùng theo vai trò nếu có truyền
    const query = role ? { roleId: role } : { roleId: { $in: ["customer", "seller", "shipper"] } };

    // Nếu có truyền isOnline, thêm điều kiện lọc online hoặc offline
    if (typeof isOnline !== "undefined") {
      query.isOnline = isOnline === "true"; // Chuyển giá trị isOnline từ string thành Boolean
    }

    // Tạo đối tượng sắp xếp
    const sortOptions = {};
    if (sortField && sortOrder) {
      sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;
    }

    // Lấy danh sách người dùng theo sắp xếp và phân trang, đồng thời populate storeIds
    let users = await User.find(query).sort(sortOptions).skip(skip).limit(limit).populate({
      path: "storeIds",
      model: "Store",
      select: "storeName storeAddress bankAccount foodType createdAt", // Lấy các trường từ Store
    });

    // Nếu roleId là shipper thì populate thêm ShipperInfo
    users = await Promise.all(
      users.map(async (user) => {
        if (user.roleId === "shipper") {
          const shipperInfo = await ShipperInfo.findOne({ userId: user._id });
          return {
            ...user.toObject(),
            shipperInfo: shipperInfo
              ? {
                  vehicleNumber: shipperInfo.vehicleNumber,
                  temporaryAddress: shipperInfo.temporaryAddress,
                  bankAccount: shipperInfo.bankAccount,
                }
              : null,
          };
        }
        return user;
      })
    );

    // Lấy tổng số tài khoản trong hệ thống
    const totalUsersInSystem = await User.countDocuments(); // Tổng số tất cả tài khoản không phân biệt loại

    // Lấy tổng số tài khoản theo bộ lọc đã áp dụng
    const totalUsers = await User.countDocuments(query);

    if (users.length === 0) {
      return res.status(404).json({ success: false, msg: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      success: true,
      data: users,
      totalFiltered: totalUsers, // Số tài khoản theo bộ lọc
      totalUsers: totalUsersInSystem, // Tổng số tài khoản không phân biệt loại
      page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ success: false, msg: "Lỗi server" });
  }
};

const sendApprovalEmail = async (email, subject, message) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text: message,
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email sent to ${email} with subject: ${subject}`);
};

const approveSeller = async (req, res) => {
  const { userId } = req.body;

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId).populate("storeIds"); // Populate để lấy thông tin cửa hàng

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem người dùng đã đăng ký làm người bán chưa và chưa được duyệt
    if (user.roleId !== "seller" || user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không trong trạng thái chờ duyệt làm người bán",
      });
    }

    // Duyệt người bán
    user.isApproved = true;

    // Tăng số lượng cửa hàng của người dùng
    await User.findByIdAndUpdate(userId, { $inc: { storeCount: 1 } });

    // Lưu thông tin người dùng
    await user.save();

    // Gửi email thông báo phê duyệt
    await sendApprovalEmail(user.email, "Yêu Cầu Đăng Ký Người Bán Được Phê Duyệt", `Chúc mừng ${user.fullName}, tài khoản của bạn đã được phê duyệt làm người bán.`);

    res.status(200).json({
      message: "Người bán đã được duyệt thành công",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const rejectSeller = async (req, res) => {
  const { userId } = req.body; // Chỉ cần userId từ request body

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem người dùng có phải người bán đang chờ duyệt hay không
    if (user.roleId !== "seller" || user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không trong trạng thái chờ duyệt làm người bán",
      });
    }

    // Xóa tất cả các cửa hàng liên kết với userId
    await Store.deleteMany({ owner: userId });

    // Thay đổi vai trò về lại "customer"
    user.roleId = "customer";
    user.isApproved = false;
    user.storeName = "";
    user.foodType = "";
    user.businessType = "";
    user.bankAccount = "";
    user.storeAddress = "";
    user.idImage = "";
    user.cccd = "";
    user.representativeName = "";

    // Xóa danh sách storeIds
    user.storeIds = [];

    // Lưu thay đổi người dùng
    await user.save();

    // Gửi email thông báo từ chối
    await sendApprovalEmail(user.email, "Yêu Cầu Đăng Ký Người Bán Bị Từ Chối", `Xin chào ${user.fullName}, yêu cầu đăng ký làm người bán của bạn đã bị từ chối.`);

    res.status(200).json({
      message: "Người dùng đã bị từ chối và quay lại vai trò customer. Cửa hàng đã bị xóa.",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getStoreCount = async (req, res) => {
  try {
    const { userId } = req.body; // Chỉ cần userId từ request body
    const user = await User.findById(userId);

    return res.status(200).json({ storeCount: user.storeCount });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi", error });
  }
};

const getAllStores = async (req, res) => {
  try {
    const {
      sortField = "storeName", // Mặc định sắp xếp theo tên cửa hàng
      sortOrder = "asc", // Mặc định sắp xếp tăng dần
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lấy danh sách cửa hàng và populate thông tin chủ cửa hàng và sản phẩm
    const stores = await Store.find()
      .populate("owner", "userName email representativeName isOnline storeCount businessType storeAddress") // Populate thông tin chủ cửa hàng
      .populate("foods") // Populate danh sách sản phẩm
      .skip(skip)
      .limit(limit);

    if (!stores || stores.length === 0) {
      return res.status(404).json({
        success: false,
        msg: "Không có cửa hàng nào trong hệ thống",
      });
    }

    // Đếm số lượng sản phẩm cho mỗi cửa hàng
    const storesWithProductCount = stores.map((store) => ({
      ...store._doc,
      productCount: store.foods ? store.foods.length : 0,
    }));

    // Thực hiện sắp xếp sau khi đã populate
    if (sortField && sortOrder) {
      storesWithProductCount.sort((a, b) => {
        let fieldA, fieldB;

        if (sortField === "owner.representativeName") {
          fieldA = a.owner.representativeName.toLowerCase();
          fieldB = b.owner.representativeName.toLowerCase();
        } else if (sortField === "owner.storeCount") {
          fieldA = a.owner.storeCount;
          fieldB = b.owner.storeCount;
        } else if (sortField === "productCount") {
          fieldA = a.productCount;
          fieldB = b.productCount;
        } else {
          fieldA = a[sortField];
          fieldB = b[sortField];
        }

        if (sortOrder === "asc") {
          return fieldA > fieldB ? 1 : fieldA < fieldB ? -1 : 0;
        } else {
          return fieldA < fieldB ? 1 : fieldA > fieldB ? -1 : 0;
        }
      });
    }

    // Đếm tổng số cửa hàng
    const totalStores = await Store.countDocuments();

    res.status(200).json({
      success: true,
      msg: "Lấy danh sách cửa hàng thành công",
      data: storesWithProductCount,
      total: totalStores,
      page,
      totalPages: Math.ceil(totalStores / limit),
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách cửa hàng:", error.message);
    res.status(500).json({
      success: false,
      msg: "Lỗi máy chủ, không thể lấy danh sách cửa hàng",
      error: error.message,
    });
  }
};

const approveShipper = async (req, res) => {
  const { userId } = req.body;

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem người dùng đã đăng ký làm shipper chưa và chưa được duyệt
    if (user.roleId !== "shipper" || user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không trong trạng thái chờ duyệt làm shipper",
      });
    }

    // Duyệt người dùng thành shipper
    user.isApproved = true;

    // Lưu thông tin người dùng
    await user.save();

    // Gửi email thông báo phê duyệt
    await sendApprovalEmail(user.email, "Yêu Cầu Đăng Ký Shipper Được Phê Duyệt", `Xin chào ${user.fullName}, yêu cầu đăng ký làm shipper của bạn đã bị từ chối.`);

    res.status(200).json({
      message: "Shipper đã được duyệt thành công",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const rejectShipper = async (req, res) => {
  const { userId } = req.body; // Chỉ cần userId từ request body

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem người dùng có phải shipper đang chờ duyệt hay không
    if (user.roleId !== "shipper" || user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không trong trạng thái chờ duyệt làm shipper",
      });
    }

    // Tìm và xóa tất cả thông tin liên quan đến shipper từ bảng ShipperInfo
    await ShipperInfo.deleteMany({ userId: user._id });

    // Xóa các trường không cần thiết trong UserPersonalInfo nhưng giữ lại userId và profilePictureURL
    const personalInfo = await UserPersonalInfo.findOne({ userId: user._id });
    if (personalInfo) {
      personalInfo.dateOfBirth = ""; // Xóa ngày sinh
      personalInfo.gender = ""; // Xóa giới tính
      personalInfo.city = ""; // Xóa thành phố
      personalInfo.state = ""; // Xóa bang
      personalInfo.postalCode = ""; // Xóa mã bưu điện
      personalInfo.country = ""; // Xóa quốc gia

      // Chỉ giữ lại userId và profilePictureURL
      await personalInfo.save();
    }

    // Thay đổi vai trò về lại "customer" và trả về giá trị trống cho các thông tin đã đăng ký
    user.roleId = "customer";
    user.isApproved = false;
    user.fullName = ""; // Trả về tên đầy đủ thành chuỗi rỗng
    user.cccd = ""; // Trả về CCCD/CMND thành chuỗi rỗng
    user.address = ""; // Trả về địa chỉ thành chuỗi rỗng

    // Lưu thay đổi người dùng
    await user.save();

    // Gửi email thông báo phê duyệt
    await sendApprovalEmail(user.email, "Yêu Cầu Đăng Ký Shipper Bị Từ Chối", `Chúc mừng ${user.fullName}, tài khoản của bạn đã được phê duyệt làm shipper.`);

    res.status(200).json({
      message: "Người dùng đã bị từ chối và quay lại vai trò customer. Thông tin shipper đã được xóa.",
      user: {
        id: user._id,
        roleId: user.roleId,
        fullName: user.fullName,
        cccd: user.cccd,
        address: user.address,
        isApproved: user.isApproved,
      },
      personalInfo, // Trả về thông tin cá nhân đã sửa đổi
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getDeliveredOrdersAndRevenue = async (req, res) => {
  try {
    // Tìm tất cả các đơn hàng có trạng thái "Delivered"
    const deliveredOrders = await StoreOrder.find({ orderStatus: "Delivered" })
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName") // Lấy tên cửa hàng
      .populate("foods", "foodName price"); // Lấy tên và giá món ăn

    // Nếu không có đơn hàng nào với trạng thái "Delivered"
    if (deliveredOrders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào đã được giao." });
    }

    // Tính tổng doanh thu bằng cách cộng tất cả totalAmount của các đơn hàng
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Chuẩn bị dữ liệu trả về
    const deliveredOrdersDetails = deliveredOrders.map((order) => ({
      orderId: order._id,
      user: {
        userId: order.user._id,
        fullName: order.user.fullName,
      },
      store: {
        storeId: order.store._id,
        storeName: order.store.storeName,
      },
      foods: order.foods.map((food) => ({
        foodName: food.foodName,
        price: food.price,
        quantity: order.foods.find((f) => f._id.equals(food._id)).quantity, // Giả sử bạn lưu quantity
      })),
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      deliveryAddress: order.deliveryAddress,
    }));

    // Trả về danh sách đơn hàng đã giao và tổng doanh thu
    res.status(200).json({
      message: "Danh sách đơn hàng đã được giao và tổng doanh thu",
      deliveredOrdersDetails,
      totalRevenue,
    });
  } catch (error) {
    console.error("Lỗi khi lấy đơn hàng đã giao và tính doanh thu:", error);
    res.status(500).json({ error: "Lỗi khi lấy đơn hàng đã giao và tính doanh thu." });
  }
};

const getAllFoods = async (req, res) => {
  const { page = 1, limit = 10, sortField = "foodName", sortOrder = "asc" } = req.query;

  try {
    // Tạo đối tượng sắp xếp, bao gồm sắp xếp theo isAvailable
    const sortOptions = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    // Tìm tất cả món ăn, phân trang và sắp xếp
    const foods = await Food.find()
      .populate({
        path: "store",
        select: "storeName",
      })
      .populate({
        path: "foodGroup",
        select: "groupName",
      })
      .sort(sortOptions) // Sắp xếp theo sortOptions
      .skip((page - 1) * limit) // Phân trang
      .limit(limit); // Giới hạn số lượng kết quả

    if (!foods || foods.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy món ăn nào" });
    }

    // Lấy tổng số lượng món ăn
    const totalItems = await Food.countDocuments();

    // Tính tổng giá trị của tất cả các món ăn
    const totalPriceOfFoods = await Food.aggregate([
      {
        $group: {
          _id: null, // Không nhóm theo bất kỳ trường nào
          totalPrice: { $sum: "$price" }, // Tính tổng tất cả giá của món ăn
        },
      },
    ]);

    res.status(200).json({
      message: "Lấy tất cả món ăn thành công",
      foods: foods.map((food) => ({
        _id: food._id,
        foodName: food.foodName,
        price: food.price,
        description: food.description,
        store: food.store.storeName,
        imageUrl: food.imageUrl,
        foodGroup: food.foodGroup.groupName,
        isAvailable: food.isAvailable,
        isForSale: food.isForSale,
        sellingTime: food.sellingTime,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt,
      })),
      totalItems, // Tổng số lượng món ăn
      totalPrice: totalPriceOfFoods.length > 0 ? totalPriceOfFoods[0].totalPrice : 0, // Tổng giá trị các món ăn
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Lỗi server:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách món ăn", error });
  }
};

const getAllOrders = async (req, res) => {
  try {
    // Lấy tất cả các đơn hàng và populate thông tin người dùng và cửa hàng
    const orders = await StoreOrder.find()
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName") // Lấy tên cửa hàng
      .populate("foods", "foodName price"); // Lấy tên và giá món ăn

    // Nếu không có đơn hàng
    if (orders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào." });
    }

    // Tính tổng số lượng đơn hàng
    const totalOrdersCount = await StoreOrder.countDocuments();

    // Tính tổng giá trị của tất cả các đơn hàng
    const totalOrderAmount = await StoreOrder.aggregate([
      {
        $group: {
          _id: null, // Không nhóm theo bất kỳ trường nào
          totalAmount: { $sum: "$totalAmount" }, // Tính tổng tất cả totalAmount của các đơn hàng
        },
      },
    ]);

    // Chuẩn bị dữ liệu trả về
    const allOrdersDetails = orders.map((order) => ({
      orderId: order._id,
      user: {
        userId: order.user._id,
        fullName: order.user.fullName,
      },
      store: {
        storeId: order.store._id,
        storeName: order.store.storeName,
      },
      foods: order.foods.map((food) => ({
        foodName: food.foodName,
        price: food.price,
        quantity: order.foods.find((f) => f._id.equals(food._id)).quantity, // Giả sử bạn lưu quantity
      })),
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    }));

    // Trả về tất cả đơn hàng, tổng số lượng đơn hàng và tổng giá trị
    res.status(200).json({
      message: "Danh sách đơn hàng",
      totalOrdersCount, // Tổng số đơn hàng
      totalOrderAmount: totalOrderAmount.length > 0 ? totalOrderAmount[0].totalAmount : 0, // Tổng giá trị của các đơn hàng
      allOrdersDetails,
    });
  } catch (error) {
    console.error("Lỗi khi lấy tất cả đơn hàng:", error);
    res.status(500).json({ error: "Lỗi khi lấy tất cả đơn hàng." });
  }
};

// const getAllUsersLogin = async (req, res) => {
//   try {
//     const {
//       sortField = "userName", // Mặc định sắp xếp theo tên
//       sortOrder = "asc", // Mặc định sắp xếp tăng dần (A -> Z)
//       role, // Lọc theo vai trò customer, seller, shipper
//       isOnline, // Lọc theo trạng thái online hoặc offline
//     } = req.query;

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     // Lọc người dùng theo vai trò nếu có truyền
//     const query = role ? { roleId: role } : { roleId: { $in: ["customer", "seller", "shipper"] } };

//     // Nếu có truyền isOnline, thêm điều kiện lọc online hoặc offline
//     if (typeof isOnline !== "undefined") {
//       query.isOnline = isOnline === "true"; // Chuyển giá trị isOnline từ string thành Boolean
//     }

//     // Tạo đối tượng sắp xếp
//     const sortOptions = {};
//     if (sortField && sortOrder) {
//       sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;
//     }

//     // Lấy danh sách người dùng theo sắp xếp và phân trang
//     let users = await User.find(query).sort(sortOptions).skip(skip).limit(limit).populate({
//       path: "storeIds",
//       model: "Store",
//       select: "storeName storeAddress bankAccount foodType createdAt", // Lấy các trường từ Store
//     });

//     // Thêm các cờ (flags) về phương thức đăng nhập trực tiếp trong dữ liệu trả về
//     users = users.map((user) => ({
//       ...user.toObject(),
//       isPhoneLogin: user.isPhoneLogin,
//       isGoogleLogin: user.isGoogleLogin,
//       isFacebookLogin: user.isFacebookLogin,
//     }));

//     // Lấy tổng số tài khoản trong hệ thống
//     const totalUsersInSystem = await User.countDocuments(); // Tổng số tất cả tài khoản không phân biệt loại

//     // Lấy tổng số tài khoản theo bộ lọc đã áp dụng
//     const totalUsers = await User.countDocuments(query);

//     if (users.length === 0) {
//       return res.status(404).json({ success: false, msg: "Không tìm thấy người dùng" });
//     }

//     return res.status(200).json({
//       success: true,
//       data: users,
//       totalFiltered: totalUsers, // Số tài khoản theo bộ lọc
//       totalUsers: totalUsersInSystem, // Tổng số tài khoản không phân biệt loại
//       page,
//       totalPages: Math.ceil(totalUsers / limit),
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     return res.status(500).json({ success: false, msg: "Lỗi server" });
//   }
// };

const getLoginMethodStatistics = async (req, res) => {
  try {
    // Đếm số lượng người dùng theo phương thức đăng nhập
    const phoneLoginCount = await User.countDocuments({ isPhoneLogin: true });
    const googleLoginCount = await User.countDocuments({ isGoogleLogin: true });
    const facebookLoginCount = await User.countDocuments({ isFacebookLogin: true });

    res.status(200).json({
      success: true,
      data: {
        phoneLoginCount,
        googleLoginCount,
        facebookLoginCount,
      },
    });
  } catch (error) {
    console.error("Error fetching login statistics:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching login statistics",
    });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAllUser,
  approveSeller,
  rejectSeller,
  getStoreCount,
  getAllStores,
  approveShipper,
  rejectShipper,
  getDeliveredOrdersAndRevenue,
  getAllUsers,
  getAllFoods,
  getAllOrders,
  getLoginMethodStatistics,
};
