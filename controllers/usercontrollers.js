const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const argon2 = require("argon2");
const Store = require("../models/store");
const Staff = require("../models/staff"); // Đường dẫn tới modal Staff của bạn
const UserPersonalInfo = require("../models/userPersonal"); // Đường dẫn tới modal Staff của bạn
const ShipperInfo = require("../models/shipper");
const Food = require("../models/food"); // Mô hình Food
// const firebase = require("../firebase");
const { rejectSeller } = require("../controllers/admincontroller");
const { rejectShipper } = require("../controllers/admincontroller");
const { sendVerificationCode, verifyCode } = require("../utils/twilioService"); // Import Twilio service

const changePassword = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    console.log("Received change password request:", {
      userId,
      currentPassword,
      newPassword,
      confirmNewPassword,
    });

    // Kiểm tra nếu thiếu dữ liệu đầu vào
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ msg: "Vui lòng điền đầy đủ các trường." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Không tìm thấy người dùng" });
    }

    console.log("User found:", user);

    // Use bcryptjs to verify the current password
    const isPasswordValid = await bcryptjs.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ msg: "Mật khẩu hiện tại không đúng" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ msg: "Mật khẩu mới và xác nhận mật khẩu không khớp" });
    }

    // Use bcryptjs to hash the new password
    const hashPass = await bcryptjs.hash(newPassword, 10);

    await User.findByIdAndUpdate(userId, { password: hashPass }, { new: true });

    return res.status(200).json({ msg: "Cập nhật mật khẩu thành công" });
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // Check if newPassword and confirmPassword match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "Mật khẩu mới và xác nhận mật khẩu không khớp",
      });
    }

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "Email không tồn tại trong hệ thống",
      });
    }

    // Hash the new password and update the user's record
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    // Send confirmation email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Mật khẩu đã được cập nhật",
      text: `Mật khẩu của bạn đã được thay đổi thành công. Nếu bạn không yêu cầu điều này, vui lòng liên hệ với chúng tôi ngay lập tức.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, msg: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Cập nhật mật khẩu thất bại",
      error: error.message,
    });
  }
};

const resetPasswordByPhone = async (req, res) => {
  try {
    const { phone, newPassword, confirmPassword } = req.body;

    // Check if newPassword and confirmPassword match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "Mật khẩu mới và xác nhận mật khẩu không khớp",
      });
    }

    // Find the user by phone number
    const user = await User.findOne({ phoneNumber: phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "Số điện thoại không tồn tại trong hệ thống",
      });
    }

    // Hash the new password and update the user's record
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.status(200).json({ success: true, msg: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Cập nhật mật khẩu thất bại",
      error: error.message,
    });
  }
};

const sendResetPasswordEmailOrPhone = async (req, res) => {
  try {
    const { emailOrPhone } = req.body; // Nhận email hoặc số điện thoại từ request body
    console.log("Dữ liệu nhận từ request:", emailOrPhone);

    // Kiểm tra xem input là email hay số điện thoại
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone); // Kiểm tra định dạng email
    const isPhone = /^[0-9]{10,15}$/.test(emailOrPhone); // Kiểm tra định dạng số điện thoại (10-15 chữ số)

    let user;
    if (isEmail) {
      user = await User.findOne({ email: emailOrPhone });
    } else if (isPhone) {
      user = await User.findOne({ phoneNumber: emailOrPhone });
    } else {
      return res.status(400).json({ success: false, msg: "Vui lòng nhập email hoặc số điện thoại hợp lệ" });
    }

    if (!user) {
      return res.status(404).json({ success: false, msg: "Email hoặc số điện thoại không tồn tại trong hệ thống" });
    }

    // Email hoặc số điện thoại tồn tại
    res.status(200).json({ success: true, msg: "Tài khoản tồn tại trong hệ thống" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Đã xảy ra lỗi khi kiểm tra thông tin",
      error: error.message,
    });
  }
};

// Hàm gửi email xác thực
const sendVerificationEmail = async (email, verificationCode) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Bỏ qua kiểm tra SSL
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Mã Xác Thực Đăng Ký",
    text: `Mã xác thực của bạn là: ${verificationCode}. Mã xác thực sẽ hết hạn sau 1 phút.`,
  };

  await transporter.sendMail(mailOptions);
};

// Hàm đăng ký người dùng
const registerUser = async (req, res, next) => {
  const { username, phone, email, password } = req.body;

  if (!username || !phone || !email || !password) {
    return next(errorHandler(400, "Tất cả các trường username, phone, email và password đều phải nhập"));
  }

  if (username.length < 7 || username.length > 20) {
    return next(errorHandler(400, "Tên người dùng phải có từ 7 đến 20 ký tự"));
  }

  if (password.length < 8) {
    return next(errorHandler(400, "Mật khẩu phải có ít nhất 8 ký tự"));
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    return next(errorHandler(400, "Số điện thoại phải bao gồm đúng 10 chữ số"));
  }

  try {
    const existingStaff = await Staff.findOne({ phone: phone, name: username });

    let role = "customer";
    let storeId = null;

    if (existingStaff) {
      if (existingStaff.user) {
        return next(errorHandler(400, "Nhân viên này đã đăng ký tài khoản"));
      }
      role = "staff";
      storeId = existingStaff.store;
    }

    const existingUser = await User.findOne({
      $or: [{ userName: username }, { phoneNumber: phone }, { email: email }],
    });

    if (existingUser) {
      if (existingUser.userName === username) {
        return next(errorHandler(400, "Tên người dùng đã tồn tại"));
      }
      if (existingUser.phoneNumber === phone) {
        return next(errorHandler(400, "Số điện thoại đã tồn tại"));
      }
      if (existingUser.email === email) {
        return next(errorHandler(400, "Email đã tồn tại"));
      }
    }

    const hashedPassword = bcryptjs.hashSync(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpiry = Date.now() + 1 * 60 * 1000;

    const newUser = new User({
      userName: username,
      phoneNumber: phone,
      email: email,
      password: hashedPassword,
      verificationCode: verificationCode,
      verificationCodeExpiry: verificationCodeExpiry,
      roleId: role,
      storeIds: storeId ? [storeId] : [],
    });

    await newUser.save();

    const defaultProfilePictureURL = "https://example.com/random-image.jpg";

    const newUserPersonalInfo = new UserPersonalInfo({
      userId: newUser._id,
      profilePictureURL: defaultProfilePictureURL,
    });

    await newUserPersonalInfo.save();

    if (role === "staff") {
      existingStaff.user = newUser._id;
      existingStaff.isActive = true;
      await existingStaff.save();

      const store = await Store.findById(storeId);
      if (store) {
        const staffIndex = store.staffList.findIndex((staff) => staff.staffId.equals(existingStaff._id));
        if (staffIndex !== -1) {
          store.staffList[staffIndex].roleId = "staff";
          await store.save();
        }
      }
    }

    // Không gọi hàm gửi mã xác thực tại đây
    res.status(201).json({
      success: true,
      message: "Đăng ký thành công! Bạn hãy chọn xác thực OTP hoặc Email.",
    });
  } catch (error) {
    next(error);
  }
};

// API verifyEmail để gửi lại mã xác thực
const sendverifyEmail = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email });

    if (!user) {
      return next(errorHandler(400, "Không tìm thấy người dùng với email này"));
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = Date.now() + 1 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(email, verificationCode);

    res.status(200).json({
      success: true,
      message: "Mã xác thực đã được gửi đến email của bạn",
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  const { phone, password } = req.body;

  // Kiểm tra xem phone và password có được nhập hay không
  if (!phone || !password) {
    return next(errorHandler(400, "Vui lòng nhập cả số điện thoại và mật khẩu"));
  }

  try {
    // Tìm người dùng với số điện thoại đã cung cấp
    const user = await User.findOne({ phoneNumber: phone });

    // Kiểm tra xem người dùng có tồn tại không
    if (!user) {
      return next(errorHandler(400, "Số điện thoại không chính xác"));
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return next(errorHandler(400, "Mật khẩu không chính xác"));
    }

    // Kiểm tra trạng thái xác thực
    if (!user.isVerified) {
      return next(errorHandler(400, "Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn để xác thực."));
    }

    // Lưu `expoPushToken` vào tài khoản khách hàng
    // if (expoPushToken) {
    //   user.expoPushToken = expoPushToken; // Cập nhật expoPushToken
    //   await user.save();
    // }

    // Nếu người dùng là "staff", kiểm tra trạng thái "isActive" và lấy thông tin storeId
    let isActive = true; // Mặc định là true nếu không phải staff
    let storeId = null; // Lưu storeId nếu là staff
    let storeIds = []; // Khai báo mảng storeIds
    if (user.roleId === "staff") {
      const staff = await Staff.findOne({ user: user._id }).populate("store");
      if (!staff) {
        return next(errorHandler(400, "Không tìm thấy thông tin nhân viên."));
      }
      isActive = staff.isActive; // Cập nhật isActive từ staff

      // Kiểm tra trạng thái active của nhân viên
      if (!isActive) {
        return next(errorHandler(403, "Tài khoản nhân viên chưa được kích hoạt. Vui lòng liên hệ quản trị viên để kích hoạt."));
      }

      // Lưu storeId từ thông tin của nhân viên
      storeId = staff.store._id;
      storeIds = [storeId]; // Thêm storeId vào mảng storeIds
    }

    // Kiểm tra trạng thái chờ duyệt nếu người dùng là "seller"
    if (user.roleId === "seller" && !user.isApproved) {
      return next(errorHandler(403, "Tài khoản của bạn đang trong trạng thái chờ duyệt, bạn không được phép đăng nhập. Xin cảm ơn!"));
    }

    if (user.roleId === "shipper" && !user.isApproved) {
      return next(errorHandler(403, "Tài khoản của bạn đang trong trạng thái chờ duyệt, bạn không được phép đăng nhập. Xin cảm ơn!"));
    }

    // Nếu người dùng là seller, lấy storeIds
    if (user.roleId === "seller") {
      // Lấy danh sách storeIds từ user
      storeIds = user.storeIds || []; // Gán giá trị cho storeIds
    }

    // Tạo token xác thực
    const token = jwt.sign(
      { id: user._id, role: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Token expires in 7 days
    );

    // Set cookie với token
    res.cookie("auth_token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    console.log("Token đã được lưu trong cookie: ", token);

    user.isOnline = true;
    await user.save();

    // Cập nhật phương thức đăng nhập là số điện thoại hoặc tài khoản trực tiếp
    await User.findByIdAndUpdate(user._id, {
      isPhoneLogin: true,
      isGoogleLogin: false,
      isFacebookLogin: false,
    });

    // Trả về phản hồi đăng nhập thành công, bao gồm isActive, storeId và storeIds (nếu là staff hoặc seller)
    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user._id,
        userName: user.userName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        roleId: user.roleId,
        isActive, // Trả về trạng thái isActive
        storeId, // Trả về storeId nếu là nhân viên
        storeIds, // Trả về mảng storeIds nếu là staff hoặc seller
        isOnline: user.isOnline, // Trả về trạng thái online
        // expoPushToken: user.expoPushToken, // Trả về expoPushToken
      },
    });
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (req, res, next) => {
  try {
    // Find the user based on the ID from the token
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Set the online status to false
    user.isOnline = false;
    await user.save();

    // Clear the auth cookie
    res.clearCookie("auth_token");

    res.status(200).json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    next(error);
  }
};

// // Đăng nhập bằng Google
// const googleCallback = (req, res) => {
//   const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
//     expiresIn: "1h",
//   });
//   res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`);
// };

// // Đăng nhập bằng Facebook
// const facebookCallback = (req, res) => {
//   const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
//     expiresIn: "1h",
//   });
//   res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`);
// };

const verifyEmail = async (req, res, next) => {
  const { email, verificationCode } = req.body;

  if (!email || !verificationCode) {
    return next(errorHandler(400, "Email và mã xác thực là bắt buộc"));
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return next(errorHandler(400, "Người dùng không tồn tại"));
    }

    if (user.isVerified) {
      return next(errorHandler(400, "Tài khoản đã được xác thực"));
    }

    if (user.verificationCode !== verificationCode) {
      return next(errorHandler(400, "Mã xác thực không đúng"));
    }

    if (user.verificationCodeExpiry < Date.now()) {
      return next(errorHandler(400, "Mã xác thực đã hết hạn"));
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Xác thực email thành công!Giờ bạn hãy đăng nhập",
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmailReset = async (req, res, next) => {
  const { email, verificationCode } = req.body;

  if (!email || !verificationCode) {
    return next(errorHandler(400, "Email và mã xác thực là bắt buộc"));
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return next(errorHandler(400, "Người dùng không tồn tại"));
    }

    if (user.verificationCode !== verificationCode) {
      return next(errorHandler(400, "Mã xác thực không đúng"));
    }

    if (user.verificationCodeExpiry < Date.now()) {
      return next(errorHandler(400, "Mã xác thực đã hết hạn"));
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Xác thực email thành công!Giờ bạn hãy đăng nhập",
    });
  } catch (error) {
    next(error);
  }
};

const sendPhoneOtp = async (req, res, next) => {
  console.log("Request body:", req.body); // Kiểm tra giá trị nhận được
  const { phone } = req.body;

  // Kiểm tra xem số điện thoại đã được cung cấp hay chưa
  if (!phone) {
    return next(errorHandler(400, "Số điện thoại là bắt buộc"));
  }

  try {
    // Tìm người dùng dựa trên số điện thoại
    const user = await User.findOne({ phoneNumber: phone });

    if (!user) {
      return next(errorHandler(400, "Số điện thoại không tồn tại"));
    }

    console.log("Sending OTP to:", phone);
    // Gửi mã OTP qua Twilio
    const status = await sendVerificationCode(phone);

    if (status === "pending") {
      return res.status(200).json({
        success: true,
        message: "Mã OTP đã được gửi qua SMS",
      });
    }

    // Trường hợp không thành công
    return res.status(500).json({
      success: false,
      message: "Không thể gửi mã OTP, vui lòng thử lại sau",
    });
  } catch (error) {
    console.error("Error in sendPhoneOtp:", error);
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi gửi mã OTP",
      error: error.message,
    });
  }
};

const verifyPhoneOtp = async (req, res, next) => {
  const { phone, verificationCode } = req.body;

  // Kiểm tra sự tồn tại của phone và verificationCode
  if (!phone || !verificationCode) {
    return next(errorHandler(400, "Số điện thoại và mã xác thực là bắt buộc"));
  }

  try {
    // Tìm người dùng dựa trên số điện thoại
    const user = await User.findOne({ phoneNumber: phone });

    if (!user) {
      return next(errorHandler(400, "Người dùng không tồn tại"));
    }

    if (user.isVerified) {
      return next(errorHandler(400, "Tài khoản đã được xác thực"));
    }

    if (user.verificationCodeExpiry < Date.now()) {
      return next(errorHandler(400, "Mã xác thực đã hết hạn"));
    }

    // Kiểm tra mã OTP qua Twilio
    const status = await verifyCode(phone, verificationCode);

    if (status === "approved") {
      // Đánh dấu tài khoản là đã xác thực
      user.isVerified = true;
      user.verificationCode = undefined; // Xóa mã cũ (nếu có)
      user.verificationCodeExpiry = undefined; // Xóa thời gian hết hạn (nếu có)
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Xác thực số điện thoại thành công! Bạn có thể đăng nhập.",
      });
    } else {
      // Nếu mã OTP không hợp lệ hoặc đã hết hạn
      return next(errorHandler(400, "Mã xác thực không hợp lệ"));
    }
  } catch (error) {
    console.error("Error in verifyPhoneOtp:", error);
    return next(errorHandler(500, "Đã xảy ra lỗi khi xác minh mã OTP"));
  }
};

const verifyPhoneOtpReset = async (req, res, next) => {
  const { phone, verificationCode } = req.body;

  // Kiểm tra sự tồn tại của phone và verificationCode
  if (!phone || !verificationCode) {
    return next(errorHandler(400, "Số điện thoại và mã xác thực là bắt buộc"));
  }

  try {
    // Tìm người dùng dựa trên số điện thoại
    const user = await User.findOne({ phoneNumber: phone });

    if (!user) {
      return next(errorHandler(400, "Người dùng không tồn tại"));
    }

    if (user.verificationCodeExpiry < Date.now()) {
      return next(errorHandler(400, "Mã xác thực đã hết hạn"));
    }

    // Kiểm tra mã OTP qua Twilio
    const status = await verifyCode(phone, verificationCode);

    if (status === "approved") {
      // Đánh dấu tài khoản là đã xác thực
      user.isVerified = true;
      user.verificationCode = undefined; // Xóa mã cũ (nếu có)
      user.verificationCodeExpiry = undefined; // Xóa thời gian hết hạn (nếu có)
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Xác thực số điện thoại thành công! Bạn có thể đăng nhập.",
      });
    } else {
      // Nếu mã OTP không hợp lệ hoặc đã hết hạn
      return next(errorHandler(400, "Mã xác thực không hợp lệ"));
    }
  } catch (error) {
    console.error("Error in verifyPhoneOtp:", error);
    return next(errorHandler(500, "Đã xảy ra lỗi khi xác minh mã OTP"));
  }
};

const getProfile = async (req, res, next) => {
  try {
    // Lấy thông tin người dùng từ database dựa trên user ID trong token
    const user = await User.findById(req.user.id).select("-password"); // Loại bỏ mật khẩu khỏi thông tin trả về

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Tìm thông tin shipper liên quan nếu có
    const shipperInfo = await ShipperInfo.findOne({ userId: req.user.id });

    // Trả về thông tin người dùng và thông tin shipper (nếu có)
    res.status(200).json({
      success: true,
      user,
      shipperInfo: shipperInfo || null, // Nếu không có thông tin shipper, trả về null
    });
  } catch (error) {
    next(error);
  }
};

const getProfileById = async (req, res, next) => {
  try {
    // Thử tìm kiếm trực tiếp người dùng trong bảng `User`
    let user = await User.findById(req.params.id).select("-password");

    // Nếu tìm thấy người dùng, trả về ngay
    if (user) {
      const shipperInfo = await ShipperInfo.findOne({ userId: user._id });
      return res.status(200).json({
        success: true,
        user,
        shipperInfo: shipperInfo || null, // Nếu không có shipperInfo, trả về null
      });
    }

    // Nếu không tìm thấy người dùng, tìm `ShipperInfo` bằng `shipperId`
    const shipperInfo = await ShipperInfo.findById(req.params.id);

    if (!shipperInfo) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin shipper hoặc người dùng" });
    }

    // Sử dụng `userId` từ `shipperInfo` để lấy thông tin `User`
    user = await User.findById(shipperInfo.userId).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại" });
    }

    // Trả về thông tin người dùng và thông tin shipper
    res.status(200).json({
      success: true,
      user,
      shipperInfo,
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  const { phone, email, fullName, address } = req.body;

  try {
    // Kiểm tra nếu bất kỳ trường nào bị thiếu
    if (!phone || !email || !fullName) {
      return next(errorHandler(400, "Tất cả các trường thông tin không được bỏ trống"));
    }

    // Tìm người dùng dựa trên ID từ token
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Kiểm tra xem email hoặc số điện thoại mới có trùng với bất kỳ ai khác không
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return next(errorHandler(400, "Email đã tồn tại"));
      }
    }

    if (phone && phone !== user.phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber: phone });
      if (phoneExists) {
        return next(errorHandler(400, "Số điện thoại đã tồn tại"));
      }
    }

    // Cập nhật thông tin người dùng
    user.phoneNumber = phone;
    user.email = email;
    user.fullName = fullName;
    user.address = address || user.address;

    // Lưu thay đổi vào cơ sở dữ liệu
    await user.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công!",
      user: {
        id: user._id,
        userName: user.userName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        fullName: user.fullName,
        address: user.address,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resendVerificationCode = async (req, res, next) => {
  const { email } = req.body;

  // Check if email is provided
  if (!email) {
    return next(errorHandler(400, "Email là bắt buộc"));
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    // If user does not exist
    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // If the user is already verified, no need to resend
    if (user.isVerified) {
      return next(errorHandler(400, "Tài khoản đã được xác thực"));
    }

    // Generate a new verification code and expiry time
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationCodeExpiry = Date.now() + 1 * 60 * 1000; // 1 minute expiry

    // Update user's verification code and expiry in the database
    user.verificationCode = newVerificationCode;
    user.verificationCodeExpiry = newVerificationCodeExpiry;
    await user.save();

    // Send the new verification code via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Mã Xác Thực Mới",
      text: `Mã xác thực mới của bạn là: ${newVerificationCode}. Mã xác thực sẽ hết hạn sau 1 phút.`,
    };

    await transporter.sendMail(mailOptions);

    // Respond with success message
    res.status(200).json({
      success: true,
      message: "Mã xác thực đã được gửi lại. Vui lòng kiểm tra email của bạn.",
    });
  } catch (error) {
    console.error("Error in resendVerificationCode:", error);
    return res.status(500).json({
      success: false,
      message: "Gửi lại mã xác thực thất bại",
      error: error.message,
    });
  }
};

const resendVerificationCodeReset = async (req, res, next) => {
  const { email } = req.body;

  // Check if email is provided
  if (!email) {
    return next(errorHandler(400, "Email là bắt buộc"));
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    // If user does not exist
    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Generate a new verification code and expiry time
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationCodeExpiry = Date.now() + 1 * 60 * 1000; // 1 minute expiry

    // Update user's verification code and expiry in the database
    user.verificationCode = newVerificationCode;
    user.verificationCodeExpiry = newVerificationCodeExpiry;
    await user.save();

    // Send the new verification code via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Mã Xác Thực Mới",
      text: `Mã xác thực mới của bạn là: ${newVerificationCode}. Mã xác thực sẽ hết hạn sau 1 phút.`,
    };

    await transporter.sendMail(mailOptions);

    // Respond with success message
    res.status(200).json({
      success: true,
      message: "Mã xác thực đã được gửi lại. Vui lòng kiểm tra email của bạn.",
    });
  } catch (error) {
    console.error("Error in resendVerificationCode:", error);
    return res.status(500).json({
      success: false,
      message: "Gửi lại mã xác thực thất bại",
      error: error.message,
    });
  }
};

const resendVerificationCodeForPhone = async (req, res, next) => {
  const { phone } = req.body;

  // Kiểm tra nếu số điện thoại được cung cấp
  if (!phone) {
    return next(errorHandler(400, "Số điện thoại là bắt buộc"));
  }

  try {
    // Tìm người dùng dựa trên số điện thoại
    const user = await User.findOne({ phoneNumber: phone });

    // Nếu người dùng không tồn tại
    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Nếu tài khoản đã được xác thực
    if (user.isVerified) {
      return next(errorHandler(400, "Tài khoản đã được xác thực"));
    }

    // Tạo mã xác thực mới và thời gian hết hạn
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationCodeExpiry = Date.now() + 1 * 60 * 1000; // Hết hạn sau 1 phút

    // Cập nhật mã xác thực và thời gian hết hạn trong cơ sở dữ liệu
    user.verificationCode = newVerificationCode;
    user.verificationCodeExpiry = newVerificationCodeExpiry;
    await user.save();

    // Gửi mã OTP qua Twilio
    const sendOtpStatus = await sendVerificationCode(phone);

    if (sendOtpStatus !== "pending") {
      return next(errorHandler(500, "Không thể gửi mã OTP qua SMS, vui lòng thử lại sau."));
    }

    // Trả về phản hồi thành công
    res.status(200).json({
      success: true,
      message: "Mã xác thực đã được gửi qua SMS. Vui lòng kiểm tra điện thoại của bạn.",
    });
  } catch (error) {
    console.error("Error in resendVerificationCodeForPhone:", error);
    return res.status(500).json({
      success: false,
      message: "Gửi lại mã xác thực thất bại",
      error: error.message,
    });
  }
};

const resendVerificationCodeForPhoneReset = async (req, res, next) => {
  const { phone } = req.body;

  // Kiểm tra nếu số điện thoại được cung cấp
  if (!phone) {
    return next(errorHandler(400, "Số điện thoại là bắt buộc"));
  }

  try {
    // Tìm người dùng dựa trên số điện thoại
    const user = await User.findOne({ phoneNumber: phone });

    // Nếu người dùng không tồn tại
    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Tạo mã xác thực mới và thời gian hết hạn
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationCodeExpiry = Date.now() + 1 * 60 * 1000; // Hết hạn sau 1 phút

    // Cập nhật mã xác thực và thời gian hết hạn trong cơ sở dữ liệu
    user.verificationCode = newVerificationCode;
    user.verificationCodeExpiry = newVerificationCodeExpiry;
    await user.save();

    // Gửi mã OTP qua Twilio
    const sendOtpStatus = await sendVerificationCode(phone);

    if (sendOtpStatus !== "pending") {
      return next(errorHandler(500, "Không thể gửi mã OTP qua SMS, vui lòng thử lại sau."));
    }

    // Trả về phản hồi thành công
    res.status(200).json({
      success: true,
      message: "Mã xác thực đã được gửi qua SMS. Vui lòng kiểm tra điện thoại của bạn.",
    });
  } catch (error) {
    console.error("Error in resendVerificationCodeForPhone:", error);
    return res.status(500).json({
      success: false,
      message: "Gửi lại mã xác thực thất bại",
      error: error.message,
    });
  }
};

const setOnlineStatus = async (req, res) => {
  try {
    const userId = req.user.id; // Lấy ID người dùng từ token
    const { isOnline } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: "Người dùng không tồn tại" });
    }

    user.isOnline = isOnline;
    await user.save();

    res.status(200).json({
      success: true,
      msg: `Trạng thái đã được cập nhật thành ${isOnline ? "on" : "off"}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Cập nhật trạng thái thất bại",
      error: error.message,
    });
  }
};

const registerSeller = async (req, res) => {
  const { userId, representativeName, cccd, storeName, foodType, businessType, bankAccount, storeAddress, idImage } = req.body;

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem tài khoản này đã là người bán hay chưa
    if (user.roleId === "seller") {
      return res.status(400).json({ message: "Tài khoản đã là người bán" });
    }

    const newStore = new Store({
      storeName: storeName || "",
      storeAddress: storeAddress || "",
      bankAccount: bankAccount || "",
      foodType: foodType || "",
      owner: userId,
    });

    // Lưu thông tin cửa hàng
    await newStore.save();
    console.log("New store created with ID:", newStore._id);

    // Cập nhật các trường khác cho người dùng
    user.roleId = "seller";
    user.representativeName = representativeName || user.representativeName;
    user.cccd = cccd || user.cccd;
    user.businessType = businessType || user.businessType;
    user.idImage = idImage || user.idImage;
    user.isApproved = false; // Đặt trạng thái chờ duyệt
    user.approvalExpiry = Date.now() + 1 * 60 * 1000; // Thời gian hết hạn sau 1 phút

    // Thêm storeId vào danh sách storeIds của người dùng
    user.storeIds.push(newStore._id);
    console.log("Store IDs after adding new store:", user.storeIds);

    // Lưu lại người dùng sau khi cập nhật
    await user.save();

    // Lấy lại thông tin người dùng và populate các cửa hàng liên kết
    const populatedUser = await User.findById(userId).populate({
      path: "storeIds",
      model: "Store",
      select: "storeName storeAddress bankAccount foodType createdAt",
    });
    console.log("Populated user with store details:", populatedUser);

    // Trả về thông tin người dùng và cửa hàng sau khi đăng ký thành công
    res.status(200).json({
      message: "Đăng ký người bán thành công, chờ admin duyệt",
      user: populatedUser,
    });

    // Thiết lập kiểm tra tự động từ chối sau 1 phút nếu chưa duyệt
    setTimeout(async () => {
      const updatedUser = await User.findById(userId);
      if (!updatedUser.isApproved && Date.now() >= updatedUser.approvalExpiry) {
        await rejectSeller({ body: { userId } }, { status: () => ({ json: () => {} }) });
        console.log(`User ${userId} đã bị từ chối tự động do quá hạn duyệt.`);
      }
    }, 24 * 60 * 60 * 1000); // Đếm ngược 1 phút
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const checkApprovalStatus = async (req, res) => {
  const { userId } = req.body; // Lấy userId từ body

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (user.roleId !== "seller" || !user.isApproved) {
      return res.status(403).json({ message: "Tài khoản chưa được duyệt làm người bán" });
    }

    res.status(200).json({ message: "Người bán đã được duyệt" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const registerShipper = async (req, res) => {
  try {
    const { userId, fullName, cccd, address, dateOfBirth, temporaryAddress, bankAccount, vehicleNumber, profilePictureURL } = req.body;

    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem tài khoản này đã là shipper hay chưa
    if (user.roleId === "shipper") {
      return res.status(400).json({ message: "Tài khoản đã là shipper" });
    }

    // Tạo hoặc cập nhật thông tin cá nhân cho shipper
    let personalInfo = await UserPersonalInfo.findOne({ userId });
    if (!personalInfo) {
      personalInfo = new UserPersonalInfo({
        userId: user._id,
        dateOfBirth: dateOfBirth || "", // Ngày sinh của shipper
        profilePictureURL: profilePictureURL || "https://example.com/default-profile-picture.jpg", // URL ảnh đại diện (nếu không có thì sử dụng ảnh mặc định)
      });
    } else {
      // Cập nhật thông tin cá nhân nếu đã tồn tại
      personalInfo.dateOfBirth = dateOfBirth || personalInfo.dateOfBirth;
      personalInfo.profilePictureURL = profilePictureURL || personalInfo.profilePictureURL;
    }

    // Lưu thông tin cá nhân
    await personalInfo.save();

    // Tạo hoặc cập nhật thông tin ShipperInfo
    let shipperInfo = await ShipperInfo.findOne({ userId: user._id });
    if (!shipperInfo) {
      shipperInfo = new ShipperInfo({
        userId: user._id,
        personalInfoId: personalInfo._id,
        temporaryAddress: temporaryAddress || "", // Địa chỉ tạm trú
        bankAccount: bankAccount || "", // Số tài khoản ngân hàng
        vehicleNumber: vehicleNumber || "", // Mã số xe của shipper
      });
    } else {
      // Cập nhật thông tin nếu ShipperInfo đã tồn tại
      shipperInfo.temporaryAddress = temporaryAddress || shipperInfo.temporaryAddress;
      shipperInfo.bankAccount = bankAccount || shipperInfo.bankAccount;
      shipperInfo.vehicleNumber = vehicleNumber || shipperInfo.vehicleNumber;
    }

    // Lưu thông tin shipper
    await shipperInfo.save();

    // Cập nhật vai trò người dùng thành shipper và đặt trạng thái chờ duyệt
    user.roleId = "shipper";
    user.fullName = fullName || user.fullName; // Cập nhật tên đầy đủ nếu cần
    user.cccd = cccd || user.cccd; // Cập nhật CCCD/CMND nếu cần
    user.address = address || user.address; // Cập nhật địa chỉ từ user
    user.isApproved = false; // Đặt trạng thái chờ duyệt
    await user.save();

    // Trả về phản hồi thành công và thông báo rằng tài khoản đang chờ duyệt
    res.status(200).json({
      message: "Đăng ký shipper thành công, chờ admin duyệt",
      user: {
        id: user._id,
        roleId: user.roleId,
        fullName: user.fullName,
        cccd: user.cccd,
        address: user.address, // Địa chỉ từ user
        isApproved: user.isApproved, // Trạng thái chờ duyệt
      },
      personalInfo,
      shipperInfo,
    });

    // Thiết lập kiểm tra tự động từ chối sau 1 phút nếu chưa duyệt
    setTimeout(async () => {
      const updatedUser = await User.findById(userId);
      if (!updatedUser.isApproved && Date.now() >= updatedUser.approvalExpiry) {
        await rejectShipper({ body: { userId } }, { status: () => ({ json: () => {} }) });
        console.log(`User ${userId} đã bị từ chối tự động do quá hạn duyệt.`);
      }
    }, 24 * 60 * 60 * 1000); // Đếm ngược 1 phút
  } catch (error) {
    console.error("Lỗi khi đăng ký shipper:", error);
    res.status(500).json({ message: "Lỗi server khi đăng ký shipper", error });
  }
};

// Hàm thêm cửa hàng yêu thích vào danh sách của người dùng
const addFavoriteStore = async (req, res) => {
  try {
    const { userId, storeId } = req.body;

    if (!userId || !storeId) {
      return res.status(400).json({ message: "Thiếu userId hoặc storeId" });
    }

    // Tìm người dùng và cửa hàng
    const user = await User.findById(userId);
    const store = await Store.findById(storeId);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (!store) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    }

    // Kiểm tra xem cửa hàng đã tồn tại trong danh sách yêu thích của người dùng chưa
    if (user.favoriteStores.includes(storeId)) {
      return res.status(400).json({ message: "Cửa hàng này đã có trong danh sách yêu thích của bạn" });
    }

    // Thêm cửa hàng vào danh sách yêu thích
    user.favoriteStores.push(storeId);
    await user.save();

    res.status(200).json({ message: "Cửa hàng đã được thêm vào danh sách yêu thích" });
  } catch (error) {
    console.error("Lỗi khi thêm cửa hàng yêu thích:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi thêm cửa hàng yêu thích." });
  }
};

// Hàm lấy danh sách cửa hàng yêu thích của người dùng
const getFavoriteStores = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Thiếu userId" });
    }

    const user = await User.findById(userId).populate("favoriteStores"); // Populate danh sách cửa hàng yêu thích

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.status(200).json({ message: "Danh sách cửa hàng yêu thích", favoriteStores: user.favoriteStores });
  } catch (error) {
    console.error("Lỗi khi lấy cửa hàng yêu thích:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi lấy cửa hàng yêu thích." });
  }
};

const removeFavoriteStore = async (req, res) => {
  try {
    const { userId, storeId } = req.body;

    if (!userId || !storeId) {
      return res.status(400).json({ message: "Thiếu userId hoặc storeId" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Kiểm tra xem cửa hàng có trong danh sách yêu thích không
    if (!user.favoriteStores.includes(storeId)) {
      return res.status(400).json({ message: "Cửa hàng không có trong danh sách yêu thích" });
    }

    // Loại bỏ cửa hàng khỏi danh sách yêu thích
    user.favoriteStores = user.favoriteStores.filter((store) => store.toString() !== storeId.toString());
    await user.save();

    res.status(200).json({ message: "Cửa hàng đã được xóa khỏi danh sách yêu thích" });
  } catch (error) {
    console.error("Lỗi khi xóa cửa hàng yêu thích:", error);
    res.status(500).json({ message: "Lỗi máy chủ khi xóa cửa hàng yêu thích." });
  }
};

module.exports = {
  registerUser,
  loginUser,
  // googleCallback,
  // facebookCallback,
  verifyEmail,
  getProfile,
  updateUser,
  sendResetPasswordEmailOrPhone,
  resetPassword,
  changePassword,
  resendVerificationCode,
  logoutUser, // Add this
  setOnlineStatus,
  registerSeller,
  checkApprovalStatus,
  registerShipper,
  verifyPhoneOtp,
  resendVerificationCodeForPhone,
  sendverifyEmail,
  getProfileById,
  sendPhoneOtp,
  addFavoriteStore,
  getFavoriteStores,
  removeFavoriteStore,
  verifyEmailReset,
  resendVerificationCodeReset,
  verifyPhoneOtpReset,
  resendVerificationCodeForPhoneReset,
  resetPasswordByPhone,
};
