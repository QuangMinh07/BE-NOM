const express = require('express');
const { uploadFile } = require('../controllers/UploadImage'); 
const { authenticateToken } = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/upload', authenticateToken,uploadFile.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có ảnh được tải lên.' });
    }
    return res.status(200).json({ success: true, message: 'Tải lên ảnh thành công.', imageUrl: req.file.path });
  } catch (error) {
    console.error('Lỗi:', error);
    return res.status(500).json({ success: false, error: 'Lỗi trong quá trình tải lên.' });
  }
});
router.post('/uploads', uploadFile.array('images', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có ảnh được tải lên.' });
    }
    const imageUrls = req.files.map((file) => file.path);
    return res.status(200).json({ success: true, message: 'Tải lên ảnh thành công.', imageUrls });
  } catch (error) {
    console.error('Lỗi:', error);
    return res.status(500).json({ success: false, error: 'Lỗi trong quá trình tải lên.' });
  }
});
module.exports = router;