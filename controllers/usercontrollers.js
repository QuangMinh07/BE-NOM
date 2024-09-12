const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const argon2 = require("argon2");

// const firebase = require("../firebase");

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
    const isPasswordValid = await bcryptjs.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({ msg: "Mật khẩu hiện tại không đúng" });
    }

    if (newPassword !== confirmNewPassword) {
      return res
        .status(400)
        .json({ msg: "Mật khẩu mới và xác nhận mật khẩu không khớp" });
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

    res
      .status(200)
      .json({ success: true, msg: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Cập nhật mật khẩu thất bại",
      error: error.message,
    });
  }
};

const sendResetPasswordEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, msg: "Email không tồn tại" });
    }

    // Email exists, send response confirming this without sending verification code
    res
      .status(200)
      .json({ success: true, msg: "Email tồn tại trong hệ thống" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Đã xảy ra lỗi khi kiểm tra email",
      error: error.message,
    });
  }
};

const registerUser = async (req, res, next) => {
  const { username, phone, email, password } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!username || !phone || !email || !password) {
    return next(
      errorHandler(
        400,
        "Tất cả các trường username, phone, email và password đều phải nhập"
      )
    );
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
    // Kiểm tra xem username, phone hoặc email đã tồn tại chưa
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

    // Mã hóa mật khẩu
    const hashedPassword = bcryptjs.hashSync(password, 10);

    // Tạo mã xác thực và thời gian hết hạn
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString(); // Mã xác thực 6 chữ số
    const verificationCodeExpiry = Date.now() + 1 * 60 * 1000; // 1 phút

    // Tạo người dùng mới
    const newUser = new User({
      userName: username,
      phoneNumber: phone,
      email: email,
      password: hashedPassword,
      verificationCode: verificationCode,
      verificationCodeExpiry: verificationCodeExpiry,
    });

    // Lưu người dùng vào cơ sở dữ liệu
    await newUser.save();

    // Gửi email xác thực
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Mã Xác Thực Đăng Ký",
      text: `Mã xác thực của bạn là: ${verificationCode}. Mã xác thực sẽ hết hạn sau 1 phút.`,
    };

    await transporter.sendMail(mailOptions);

    // Trả về phản hồi yêu cầu xác thực email
    res.status(201).json({
      success: true,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác thực.",
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  const { phone, password } = req.body;

  // Kiểm tra xem phone và password có được nhập hay không
  if (!phone || !password) {
    return next(
      errorHandler(400, "Vui lòng nhập cả số điện thoại và mật khẩu")
    );
  }

  try {
    // Tìm người dùng với số điện thoại đã cung cấp
    const user = await User.findOne({ phoneNumber: phone });

    // Kiểm tra xem người dùng có tồn tại không
    if (!user) {
      return next(errorHandler(400, "Số điện thoại không chính xác"));
    }

    // Kiểm tra trạng thái xác thực
    if (!user.isVerified) {
      return next(
        errorHandler(
          400,
          "Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn để xác thực."
        )
      );
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return next(errorHandler(400, "Mật khẩu không chính xác"));
    }

    // Tạo token xác thực
    const token = jwt.sign(
      { id: user._id, role: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Token expires in 7 days
    );

    // Set cookie with token
    res.cookie("auth_token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      // Remove sameSite and secure for testing purposes
      // sameSite: 'Strict',
      // secure: true,
    });

    console.log("Token đã được lưu trong cookie: ", token);

    user.isOnline = true;
    await user.save();

    // Trả về phản hồi đăng nhập thành công
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
        isOnline: user.isOnline, // Return online status
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

const getProfile = async (req, res, next) => {
  try {
    // Lấy thông tin người dùng từ database dựa trên user ID trong token
    const user = await User.findById(req.user.id).select("-password"); // Loại bỏ mật khẩu khỏi thông tin trả về

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Trả về thông tin người dùng
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  const { phone, email, fullName, address } = req.body;

  try {
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
    user.phoneNumber = phone || user.phoneNumber;
    user.email = email || user.email;
    user.fullName = fullName || user.fullName;
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
    const newVerificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
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

const setOnlineStatus = async (req, res) => {
  try {
    const userId = req.user.id; // Lấy ID người dùng từ token
    const { isOnline } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, msg: "Người dùng không tồn tại" });
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
  const {
    userId,
    representativeName,
    cccd,
    storeName,
    foodType,
    businessType,
    bankAccount,
    storeAddress,
    idImage,
  } = req.body;

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

    // Cập nhật tài khoản thành người bán
    user.roleId = "seller";
    user.representativeName = representativeName || user.representativeName;
    user.cccd = cccd || user.cccd; // CCCD/CMND
    user.storeName = storeName || user.storeName;
    user.foodType = foodType || user.foodType;
    user.businessType = businessType || user.businessType;
    user.bankAccount = bankAccount || user.bankAccount;
    user.storeAddress = storeAddress || user.storeAddress;
    user.idImage = idImage || user.idImage;
    user.isApproved = false; // Đặt trạng thái chờ duyệt

    // Lưu lại các thay đổi cho người dùng
    await user.save();

    res.status(200).json({
      message: "Đăng ký người bán thành công, chờ admin duyệt",
      user,
    });
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
      return res
        .status(403)
        .json({ message: "Tài khoản chưa được duyệt làm người bán" });
    }

    res.status(200).json({ message: "Người bán đã được duyệt" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
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
  sendResetPasswordEmail,
  resetPassword,
  changePassword,
  resendVerificationCode,
  logoutUser, // Add this
  setOnlineStatus,
  registerSeller,
  checkApprovalStatus,
};
