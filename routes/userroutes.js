const express = require("express");
const { sendPhoneOtp, verifyEmail, getProfile, loginUser, registerUser, sendverifyEmail, resendVerificationCodeForPhone, verifyPhoneOtp, updateUser, sendResetPasswordEmail, resetPassword, changePassword, resendVerificationCode, logoutUser, setOnlineStatus, registerSeller, checkApprovalStatus, registerShipper, getProfileById } = require("../controllers/usercontrollers");
// const passport = require('passport');
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Route cho đăng ký người dùng
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", authenticateToken, logoutUser);
router.post("/verify-email", verifyEmail); // Route để xác thực email
router.post("/send-verify-email", sendverifyEmail); // Route để xác thực email
router.post("/verify-PhoneOtp", verifyPhoneOtp);
router.post("/send-phone-otp", sendPhoneOtp);
router.post("/resend-verification-code", resendVerificationCode);
router.post("/resend-verification-codePhone", resendVerificationCodeForPhone);
router.put("/setOnlineStatus", authenticateToken, setOnlineStatus);

// Route để lấy thông tin profile (yêu cầu xác thực token)
router.get("/profile", authenticateToken, getProfile);
router.put("/update", authenticateToken, updateUser);
router.post("/send-reset-password", sendResetPasswordEmail);
router.post("/reset-password", resetPassword);
router.put("/changePassword/:userId", authenticateToken, changePassword);
router.post("/register-seller", authenticateToken, registerSeller);
router.post("/register-shipper", authenticateToken, registerShipper);
router.get("/check-approval", authenticateToken, checkApprovalStatus);
router.get("/profile/:id", authenticateToken, getProfileById); // Endpoint mới lấy thông tin người dùng theo id

// router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
// router.get('/google/callback',
//   passport.authenticate('google', { session: false, failureRedirect: '/login' }),
//   userController.googleCallback
// );

// // Facebook Authentication Routes
// router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
// router.get('/facebook/callback',
//   passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
//   userController.facebookCallback
// );

module.exports = router;
