const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer"); 

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
      {
        expiresIn: "1h",
      }
    );

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
      },
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
      message: "Xác thực email thành công!",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  // googleCallback,
  // facebookCallback,
  verifyEmail,
};
