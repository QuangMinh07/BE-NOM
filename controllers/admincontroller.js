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
const Staff = require("../models/staff"); // Đường dẫn tới modal Staff của bạn
const FoodGroup = require("../models/foodgroup"); // Import model FoodGroup
const OrderReview = require("../models/orderReview");

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
    const query = role ? { roleId: role } : { roleId: { $in: ["customer", "seller", "shipper", "staff"] } };

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
    const { page = 1, limit = 10, sortField = "storeName", sortOrder = "asc" } = req.query;

    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;

    // Lấy danh sách cửa hàng và populate thông tin chủ cửa hàng và sản phẩm
    const stores = await Store.find()
      .populate("owner", "userName email representativeName isOnline storeCount businessType storeAddress") // Populate thông tin chủ cửa hàng
      .populate("foods") // Populate danh sách sản phẩm
      .skip((page - 1) * limit) // Phân trang
      .limit(limit); // Giới hạn số lượng kết quả

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
        select: "storeName _id", // Bao gồm cả storeName và _id
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
        store: {
          storeId: food.store?._id, // Lấy storeId
          storeName: food.store?.storeName, // Lấy storeName
        },
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
  const { page = 1, limit = 10, sortField = "orderDate", sortOrder = "desc", orderStatus } = req.query;

  try {
    // Tạo đối tượng sắp xếp
    const sortOptions = { [sortField]: sortOrder === "asc" ? 1 : -1 };

    // Tạo bộ lọc theo trạng thái đơn hàng (nếu có)
    const filterOptions = orderStatus ? { orderStatus } : {};

    // Lấy tất cả các đơn hàng, phân trang, sắp xếp, và lọc
    const orders = await StoreOrder.find(filterOptions)
      .populate("user", "fullName loyaltyPoints") // Lấy tên người dùng
      .populate("store", "storeName") // Lấy tên cửa hàng
      .populate("foods", "foodName price") // Lấy tên và giá món ăn
      .populate({
        path: "shipper",
        populate: {
          path: "userId",
          select: "fullName",
        },
        select: "temporaryAddress vehicleNumber bankAccount",
      }) // Lấy thông tin shipper
      .sort(sortOptions) // Sắp xếp theo tiêu chí
      .skip((page - 1) * limit) // Bỏ qua các đơn hàng không thuộc trang hiện tại
      .limit(limit); // Giới hạn số lượng kết quả trả về

    // Nếu không có đơn hàng
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào." });
    }

    // Tính tổng số lượng đơn hàng
    const totalOrdersCount = await StoreOrder.countDocuments(filterOptions);

    // Tính tổng giá trị của tất cả các đơn hàng
    const totalOrderAmount = await StoreOrder.aggregate([
      { $match: filterOptions }, // Áp dụng bộ lọc nếu có
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
        userId: order.user?._id || null,
        fullName: order.user?.fullName || "Không rõ",
        loyaltyPoints: order.user?.loyaltyPoints || "Không có",
      },
      store: {
        storeId: order.store?._id || null,
        storeName: order.store?.storeName || "Không rõ",
      },
      shipper: order.shipper
        ? {
            shipperId: order.shipper._id,
            fullName: order.shipper.userId?.fullName || "Không rõ",
            temporaryAddress: order.shipper.temporaryAddress,
            vehicleNumber: order.shipper.vehicleNumber,
            bankAccount: order.shipper.bankAccount,
          }
        : null,
      foods: order.foods.map((food) => ({
        foodName: food.foodName,
        price: food.price,
        quantity: order.foods.find((f) => f._id.equals(food._id)).quantity, // Giả sử bạn lưu quantity
      })),
      cartSnapshot: order.cartSnapshot
        ? {
            totalPrice: order.cartSnapshot.totalPrice,
            deliveryAddress: order.cartSnapshot.deliveryAddress,
            receiverName: order.cartSnapshot.receiverName,
            receiverPhone: order.cartSnapshot.receiverPhone,
            items: order.cartSnapshot.items.map((item) => ({
              foodName: item.foodName,
              quantity: item.quantity,
              price: item.price,
              combos: item.combos
                ? {
                    totalPrice: item.combos.totalPrice,
                    totalQuantity: item.combos.totalQuantity,
                    foods: item.combos.foods.map((combo) => ({
                      foodName: combo.foodName,
                      price: combo.price,
                    })),
                  }
                : null,
            })),
          }
        : null,
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      loyaltyPointsUsed: order.loyaltyPointsUsed || 0, // Điểm trung thành đã sử dụng
      useLoyaltyPoints: order.useLoyaltyPoints || false, // Sử dụng điểm trung thành không
      isNotificationSent: order.isNotificationSent,
    }));

    // Trả về tất cả đơn hàng, tổng số lượng đơn hàng và tổng giá trị
    res.status(200).json({
      message: "Danh sách đơn hàng",
      totalOrdersCount, // Tổng số đơn hàng
      totalOrderAmount: totalOrderAmount.length > 0 ? totalOrderAmount[0].totalAmount : 0, // Tổng giá trị của các đơn hàng
      totalPages: Math.ceil(totalOrdersCount / limit),
      currentPage: page,
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

const sendNotificationEmail = async (email, subject, message) => {
  try {
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
  } catch (error) {
    console.error(`Lỗi khi gửi email tới ${email}:`, error.message);
  }
};

const lockStore = async (req, res) => {
  const { storeId } = req.body;

  try {
    const store = await Store.findById(storeId).populate("owner", "email fullName");

    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.lockStatus !== "unlocked") {
      return res.status(400).json({ message: "Cửa hàng đã bị khóa trước đó hoặc đang chờ xóa." });
    }

    store.lockStatus = "locked"; // Đặt trạng thái là đã bị khóa
    store.deletionScheduledAt = Date.now() + 15 * 24 * 60 * 60 * 1000; // Thời gian xóa sau 15 ngày
    store.updatedAt = new Date();
    await store.save();

    console.log(`Cửa hàng ${store.storeName} đã bị khóa.`);

    // Gửi email thông báo khóa
    if (store.owner && store.owner.email) {
      const subject = "Thông báo: Cửa hàng của bạn đã bị khóa";
      const message = `Kính gửi ${store.owner.fullName},\n\nCửa hàng "${store.storeName}" của bạn đã bị khóa. Nếu bạn không mở khóa trong vòng 15 ngày, cửa hàng và dữ liệu liên quan sẽ bị xóa.\n\nTrân trọng,\nĐội ngũ hỗ trợ`;

      try {
        await sendNotificationEmail(store.owner.email, subject, message);
      } catch (error) {
        console.error("Error sending email:", error.message);
      }
    } else {
      console.error("Không tìm thấy email của chủ cửa hàng.");
    }

    // Đặt hẹn xóa sau 15 ngày
    setTimeout(async () => {
      try {
        const storeToDelete = await Store.findById(storeId).populate("owner", "email fullName");

        if (!storeToDelete) {
          console.log("Không tìm thấy cửa hàng trong cơ sở dữ liệu.");
          return;
        }

        console.log("Thông tin cửa hàng trước khi xóa:", storeToDelete);

        // Lưu thông tin chủ sở hữu trước khi xóa
        const ownerEmail = storeToDelete.owner?.email;
        const ownerFullName = storeToDelete.owner?.fullName;
        const storeName = storeToDelete.storeName;

        // Kiểm tra lại trạng thái lockStatus
        if (storeToDelete.lockStatus === "locked") {
          console.log(`Bắt đầu xóa cửa hàng ${storeToDelete.storeName}.`);

          // Xóa tất cả dữ liệu liên quan
          await Food.deleteMany({ store: storeId });
          await FoodGroup.deleteMany({ store: storeId });
          await OrderReview.deleteMany({ store: storeId });
          await Staff.deleteMany({ store: storeId });

          // Lưu thông tin trước khi xóa
          const tempOwner = { email: ownerEmail, fullName: ownerFullName, storeName };

          await Store.findByIdAndDelete(storeId);

          // Cập nhật chủ cửa hàng
          const owner = await User.findById(storeToDelete.owner);
          if (owner) {
            owner.roleId = "customer";
            owner.isApproved = false;
            owner.representativeName = "";
            owner.businessType = "";
            owner.cccd = "";
            owner.storeIds = owner.storeIds.filter((id) => !id.equals(storeId));
            owner.storeCount = Math.max(0, owner.storeCount - 1);
            await owner.save();
          }

          console.log(`Đã xóa cửa hàng ${tempOwner.storeName} và cập nhật thông tin người dùng.`);

          // Gửi email thông báo đã xóa
          if (tempOwner.email) {
            const deleteSubject = "Thông báo: Cửa hàng của bạn đã bị xóa";
            const deleteMessage = `Kính gửi ${tempOwner.fullName},\n\nCửa hàng "${tempOwner.storeName}" của bạn đã bị xóa do không mở khóa trong thời hạn quy định.\n\nTrân trọng,\nĐội ngũ hỗ trợ`;

            try {
              await sendNotificationEmail(tempOwner.email, deleteSubject, deleteMessage);
            } catch (error) {
              console.error("Error sending deletion email:", error.message);
            }
          } else {
            console.error("Không tìm thấy email của chủ cửa hàng để gửi thông báo xóa.");
          }
        } else {
          console.log("Cửa hàng đã được mở khóa hoặc không tồn tại. Không thực hiện xóa.");
        }
      } catch (error) {
        console.error("Lỗi khi xóa cửa hàng:", error.message);
      }
    }, 15 * 24 * 60 * 60 * 1000); // 1 phút

    res.status(200).json({
      success: true,
      message: `Cửa hàng ${store.storeName} đã bị khóa. Sẽ bị xóa nếu không mở khóa trong 15 ngày.`,
    });
  } catch (error) {
    console.error("Lỗi khi khóa cửa hàng:", error.message);
    res.status(500).json({ message: "Lỗi máy chủ khi khóa cửa hàng" });
  }
};

const unlockStore = async (req, res) => {
  const { storeId } = req.body;

  try {
    const store = await Store.findById(storeId).populate("owner", "email fullName");

    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.lockStatus === "unlocked") {
      return res.status(400).json({ message: "Cửa hàng đã được mở khóa trước đó." });
    }

    store.lockStatus = "unlocked"; // Đặt trạng thái là mở khóa
    store.updatedAt = new Date();
    await store.save();

    // Gửi email thông báo
    if (store.owner && store.owner.email) {
      const subject = "Thông báo: Cửa hàng của bạn đã được mở khóa";
      const message = `Kính gửi ${store.owner.fullName},\n\nCửa hàng "${store.storeName}" của bạn đã được mở khóa và có thể hoạt động trở lại.\n\nCảm ơn bạn đã hợp tác.\n\nTrân trọng,\nĐội ngũ hỗ trợ`;

      try {
        await sendNotificationEmail(store.owner.email, subject, message);
      } catch (error) {
        console.error("Error sending email:", error.message);
      }
    } else {
      console.error("Không tìm thấy email của chủ cửa hàng.");
    }

    res.status(200).json({
      success: true,
      message: `Cửa hàng ${store.storeName} đã được mở khóa.`,
    });
  } catch (error) {
    console.error("Lỗi khi mở khóa cửa hàng:", error.message);
    res.status(500).json({ message: "Lỗi máy chủ khi mở khóa cửa hàng" });
  }
};

const deleteUser = async (req, res) => {
  const { userIds, deleteImmediately } = req.body; // Nhận thêm tham số deleteImmediately
  console.log("User IDs received:", userIds);
  console.log("Delete Immediately:", deleteImmediately);

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: "Danh sách userIds không hợp lệ" });
  }

  try {
    // Tìm các người dùng cần xử lý
    const usersToDelete = await User.find({ _id: { $in: userIds } });

    if (usersToDelete.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng để xóa" });
    }

    if (deleteImmediately) {
      // Xóa ngay lập tức
      for (const user of usersToDelete) {
        const userEmail = user.email;
        const userFullName = user.fullName;

        console.log(`Xóa ngay lập tức người dùng ${user.userName}`);

        // Xóa dữ liệu liên quan
        await UserPersonalInfo.deleteMany({ userId: user._id });
        await Store.deleteMany({ owner: user._id });
        await User.findByIdAndDelete(user._id);

        console.log(`Người dùng ${userFullName} đã bị xóa thành công.`);

        // Gửi email thông báo xóa
        if (userEmail) {
          const deleteSubject = "Thông báo: Tài khoản của bạn đã bị xóa";
          const deleteMessage = `Kính gửi ${userFullName},\n\nTài khoản của bạn đã bị xóa theo yêu cầu.\n\nTrân trọng,\nĐội ngũ hỗ trợ`;
          try {
            await sendNotificationEmail(userEmail, deleteSubject, deleteMessage);
            console.log(`Email thông báo xóa đã được gửi tới ${userEmail}.`);
          } catch (error) {
            console.error("Error sending deletion email:", error.message);
          }
        }
      }
      return res.status(200).json({
        success: true,
        message: "Người dùng đã được xóa ngay lập tức.",
      });
    } else {
      // Thiết lập xóa sau 15 ngày
      for (const user of usersToDelete) {
        const userEmail = user.email;
        const userFullName = user.fullName;

        console.log(`Thiết lập xóa người dùng ${user.userName} sau 15 ngày.`);

        // Gửi email thông báo chờ xóa
        if (userEmail) {
          const subject = "Thông báo: Tài khoản của bạn đang chờ xóa";
          const message = `Kính gửi ${userFullName},\n\nTài khoản của bạn đang trong trạng thái chờ xóa. Nếu bạn không đăng nhập trong vòng 15 ngày, tài khoản và dữ liệu liên quan sẽ bị xóa vĩnh viễn.\n\nTrân trọng,\nĐội ngũ hỗ trợ`;
          try {
            await sendNotificationEmail(userEmail, subject, message);
            console.log(`Email thông báo đã được gửi tới ${userEmail}.`);
          } catch (error) {
            console.error("Error sending immediate email:", error.message);
          }
        }

        setTimeout(async () => {
          try {
            const userToDelete = await User.findById(user._id);

            if (!userToDelete) {
              console.log(`Không tìm thấy người dùng ${user._id} trong cơ sở dữ liệu.`);
              return;
            }

            const deletionThreshold = new Date();
            deletionThreshold.setDate(deletionThreshold.getDate() - 15);

            if (new Date(userToDelete.updatedAt) < deletionThreshold) {
              console.log(`Xóa người dùng ${userToDelete.userName} do không hoạt động trong 15 ngày.`);

              // Xóa các dữ liệu liên quan
              await UserPersonalInfo.deleteMany({ userId: user._id });
              await Store.deleteMany({ owner: user._id });
              await User.findByIdAndDelete(user._id);

              console.log(`Người dùng ${userFullName} đã bị xóa thành công.`);
            } else {
              console.log("Người dùng đã hoạt động trở lại. Không thực hiện xóa.");
            }
          } catch (error) {
            console.error("Lỗi khi xóa người dùng:", error.message);
          }
        }, 15 * 24 * 60 * 60 * 1000); // 15 ngày
      }

      return res.status(200).json({
        success: true,
        message: "Đã thiết lập trạng thái chờ xóa cho các người dùng.",
      });
    }
  } catch (error) {
    console.error("Lỗi khi xử lý người dùng:", error.message);
    res.status(500).json({ message: "Lỗi máy chủ khi xử lý người dùng" });
  }
};

const getDeliveredOrdersAndRevenueFoodType = async (req, res) => {
  try {
    // Tìm tất cả các đơn hàng có trạng thái "Delivered"
    const deliveredOrders = await StoreOrder.find({ orderStatus: "Delivered" })
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName foodType") // Lấy tên cửa hàng và foodType của cửa hàng
      .populate("foods", "foodName price"); // Lấy tên và giá món ăn

    // Nếu không có đơn hàng nào với trạng thái "Delivered"
    if (deliveredOrders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào đã được giao." });
    }

    // Tính tổng doanh thu của tất cả các đơn hàng
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Tính doanh thu của cửa hàng theo foodType (cộng doanh thu cho tất cả cửa hàng có foodType đó)
    const storeRevenueByFoodType = {};

    // Duyệt qua tất cả các đơn hàng
    deliveredOrders.forEach((order) => {
      const foodType = order.store.foodType; // Lấy foodType của cửa hàng

      // Kiểm tra xem nhóm foodType đã tồn tại chưa trong storeRevenueByFoodType
      if (!storeRevenueByFoodType[foodType]) {
        storeRevenueByFoodType[foodType] = 0; // Khởi tạo doanh thu cho foodType
      }

      // Cộng doanh thu của cửa hàng vào foodType
      storeRevenueByFoodType[foodType] += order.totalAmount;
    });

    // Trả về dữ liệu tổng doanh thu và doanh thu theo foodType cho cửa hàng
    res.status(200).json({
      message: "Danh sách đơn hàng đã được giao, tổng doanh thu và doanh thu cửa hàng theo foodType",
      deliveredOrdersDetails: deliveredOrders,
      totalRevenue, // Tổng doanh thu của tất cả các đơn hàng
      storeRevenuePerFoodType: storeRevenueByFoodType, // Doanh thu cho từng foodType
    });
  } catch (error) {
    console.error("Lỗi khi lấy đơn hàng đã giao và tính doanh thu:", error);
    res.status(500).json({ error: "Lỗi khi lấy đơn hàng đã giao và tính doanh thu." });
  }
};

const getRevenueByPaymentMethod = async (req, res) => {
  try {
    // Lấy tất cả các đơn hàng có trạng thái "Delivered"
    const deliveredOrders = await StoreOrder.aggregate([
      {
        $match: { orderStatus: "Delivered" }, // Chỉ lấy đơn hàng có trạng thái "Delivered"
      },
      {
        $project: {
          paymentMethod: 1, // Lấy phương thức thanh toán
          totalAmount: 1, // Lấy tổng doanh thu của đơn hàng
          orderDate: 1, // Lấy ngày đơn hàng
          month: { $month: "$orderDate" }, // Trích xuất tháng từ orderDate
          year: { $year: "$orderDate" }, // Trích xuất năm từ orderDate
        },
      },
      {
        $group: {
          _id: { paymentMethod: "$paymentMethod", month: "$month", year: "$year" }, // Nhóm theo phương thức thanh toán, tháng và năm
          totalRevenue: { $sum: "$totalAmount" }, // Tính tổng doanh thu cho mỗi nhóm
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }, // Sắp xếp theo năm và tháng
      },
    ]);

    if (deliveredOrders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào đã được giao." });
    }

    // Chuẩn bị dữ liệu trả về
    const revenueByPaymentMethod = {};

    deliveredOrders.forEach((order) => {
      const { paymentMethod, month, year } = order._id;
      const totalRevenue = order.totalRevenue;

      if (!revenueByPaymentMethod[paymentMethod]) {
        revenueByPaymentMethod[paymentMethod] = [];
      }

      // Lưu doanh thu theo tháng cho từng phương thức thanh toán
      revenueByPaymentMethod[paymentMethod].push({
        month,
        year,
        totalRevenue,
      });
    });

    // Trả về tổng doanh thu theo phương thức thanh toán và tháng
    res.status(200).json({
      message: "Tổng doanh thu theo phương thức thanh toán và tháng",
      revenueByPaymentMethod,
    });
  } catch (error) {
    console.error("Lỗi khi tính doanh thu theo phương thức thanh toán:", error);
    res.status(500).json({ error: "Lỗi khi tính doanh thu theo phương thức thanh toán." });
  }
};

const getRevenueByMonthAndYear = async (req, res) => {
  try {
    // Tính tổng doanh thu của các đơn hàng theo tháng và năm
    const revenueByMonthAndYear = await StoreOrder.aggregate([
      {
        $match: { orderStatus: "Delivered" }, // Lọc đơn hàng đã giao
      },
      {
        $project: {
          totalAmount: 1, // Tổng doanh thu của đơn hàng
          orderDate: 1, // Ngày đơn hàng
          month: { $month: "$orderDate" }, // Trích xuất tháng từ orderDate
          year: { $year: "$orderDate" }, // Trích xuất năm từ orderDate
        },
      },
      {
        $group: {
          _id: { month: "$month", year: "$year" }, // Nhóm theo tháng và năm
          totalRevenue: { $sum: "$totalAmount" }, // Tính tổng doanh thu của mỗi tháng
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }, // Sắp xếp theo năm và tháng
      },
    ]);

    // Nếu không có đơn hàng nào
    if (revenueByMonthAndYear.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào đã được giao." });
    }

    // Trả về tổng doanh thu theo tháng và năm
    res.status(200).json({
      message: "Tổng doanh thu theo tháng và năm",
      revenueByMonthAndYear,
    });
  } catch (error) {
    console.error("Lỗi khi tính doanh thu theo tháng và năm:", error);
    res.status(500).json({ error: "Lỗi khi tính doanh thu theo tháng và năm." });
  }
};

const getReviewByOrderId = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Tìm đánh giá dựa trên orderId
    const review = await OrderReview.findOne({ order: orderId })
      .populate({
        path: "user",
        select: "fullName email",
      })
      .populate({
        path: "store",
        select: "storeName",
      })
      .populate({
        path: "replies.user",
        select: "fullName email",
      });

    // Nếu không tìm thấy đánh giá
    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy đánh giá cho đơn hàng này." });
    }

    // Chuẩn bị dữ liệu trả về
    const formattedReview = {
      _id: review._id,
      user: {
        userId: review.user?._id || null,
        fullName: review.user?.fullName || "Ẩn danh",
        email: review.user?.email || "Không rõ",
      },
      store: {
        storeId: review.store?._id || null,
        storeName: review.store?.storeName || "Không rõ",
      },
      rating: review.rating,
      comment: review.comment,
      reviewDate: review.reviewDate,
      replies: review.replies.map((reply) => ({
        _id: reply._id,
        replyText: reply.replyText,
        replyDate: reply.replyDate,
        user: reply.user?.fullName || "Ẩn danh",
      })),
    };

    res.status(200).json({
      message: "Lấy thông tin đánh giá thành công",
      review: formattedReview,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin đánh giá:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin đánh giá", error: error.message });
  }
};

const sendOrderNotificationToStore = async (orderId) => {
  try {
    // Lấy thông tin đơn hàng
    const order = await StoreOrder.findById(orderId)
      .populate("store", "storeName owner") // Lấy tên cửa hàng và thông tin owner
      .populate("foods", "foodName quantity price") // Lấy thông tin món ăn
      .populate("user", "fullName email") // Lấy thông tin người đặt hàng
      .populate("cartSnapshot"); // Lấy thông tin cart snapshot nếu có

    if (!order) {
      console.error("Không tìm thấy đơn hàng với ID:", orderId);
      return;
    }

    // Lấy thông tin cửa hàng từ đơn hàng
    const store = await Store.findById(order.store._id).populate("owner", "email fullName");
    if (!store) {
      console.error("Không tìm thấy cửa hàng với ID:", order.store._id);
      return;
    }

    // Lấy thông tin chủ cửa hàng
    const owner = store.owner;
    if (!owner || !owner.email) {
      console.error("Không tìm thấy email của chủ cửa hàng:", store._id);
      return;
    }

    // Chuẩn bị nội dung email
    const subject = `Thông báo: Cập nhật đơn hàng ${orderId}`;
    const message = `
      Kính gửi ${owner.fullName},

      Cửa hàng "${store.storeName}" vừa nhận được thông báo liên quan đến đơn hàng với chi tiết như sau:

      - Mã đơn hàng: ${order._id}
      - Ngày đặt hàng: ${new Date(order.orderDate).toLocaleDateString()}
      - Tổng tiền: ${order.totalAmount.toLocaleString("vi-VN")} VND
      - Phương thức thanh toán: ${order.paymentMethod}
      - Trạng thái thanh toán: ${order.paymentStatus}
      - Trạng thái đơn hàng: ${order.orderStatus}

      Thông tin người đặt hàng:
      - Họ và tên: ${order.user?.fullName || "Không rõ"}
      - Email: ${order.user?.email || "Không rõ"}

      Danh sách món ăn:
      ${order.foods.map((food, index) => `  ${index + 1}. ${food.foodName} - Số lượng: ${food.quantity} - Giá: ${food.price.toLocaleString("vi-VN")} VND`).join("\n")}

      Địa chỉ giao hàng: ${order.cartSnapshot?.deliveryAddress || "Không rõ"}

      Tổng tiền admin chuyển khoản cho cửa hàng của bạn: ${order.totalAmount.toLocaleString("vi-VN")} VND

      Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi với số điện thoại 0941432773.

      Trân trọng,
      Đội ngũ hỗ trợ
    `;

    // Gửi email
    await sendNotificationEmail(owner.email, subject, message);

    console.log(`Thông báo đơn hàng đã được gửi tới email: ${owner.email}`);
  } catch (error) {
    console.error("Lỗi khi gửi thông báo email:", error.message);
  }
};

const sendWarningNotificationToUser = async (storeId, foodId) => {
  try {
    // Tìm cửa hàng dựa trên storeId
    const store = await Store.findById(storeId).populate("owner", "email fullName");
    if (!store) {
      console.error("Không tìm thấy cửa hàng với ID:", storeId);
      return;
    }

    // Tìm món ăn dựa trên foodId
    const food = await Food.findById(foodId).populate("store", "storeName");
    if (!food || !food.store._id.equals(storeId)) {
      console.error("Không tìm thấy món ăn hoặc món ăn không thuộc cửa hàng:", foodId);
      return;
    }

    // Lấy thông tin chủ cửa hàng
    const owner = store.owner;
    if (!owner || !owner.email) {
      console.error("Không tìm thấy email của chủ cửa hàng:", storeId);
      return;
    }

    // Chuẩn bị nội dung email cảnh báo
    const subject = `Cảnh báo: Cửa hàng ${store.storeName} và món ăn ${food.foodName}`;
    const message = `
      Kính gửi ${owner.fullName},

      Đây là cảnh báo liên quan đến cửa hàng "${store.storeName}" và món ăn "${food.foodName}" thuộc cửa hàng của bạn.

      - Mã cửa hàng: ${store._id}
      - Tên cửa hàng: ${store.storeName}
      - Mã món ăn: ${food._id}
      - Tên món ăn: ${food.foodName}
      - Giá món ăn: ${food.price.toLocaleString("vi-VN")} VND

      Vui lòng kiểm tra và cập nhật thông tin món ăn cho phù hợp, nếu không chúng tôi sẽ xóa món ăn đó. Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua số điện thoại hỗ trợ (0941432773).

      Trân trọng,
      Đội ngũ hỗ trợ
    `;

    // Gửi email
    await sendNotificationEmail(owner.email, subject, message);

    console.log(`Email cảnh báo đã được gửi tới email: ${owner.email}`);
  } catch (error) {
    console.error("Lỗi khi gửi cảnh báo qua email:", error.message);
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
  lockStore,
  unlockStore,
  deleteUser,
  getDeliveredOrdersAndRevenueFoodType,
  getRevenueByPaymentMethod,
  getRevenueByMonthAndYear,
  getReviewByOrderId,
  sendOrderNotificationToStore,
  sendWarningNotificationToUser,
};
