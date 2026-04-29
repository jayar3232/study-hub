
const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const File = require('../models/File');
const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.post('/upload/:groupId', auth, upload.single('file'), async (req, res) => {
  try {
    const file = new File({
      groupId: req.params.groupId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadedBy: req.user
    });
    await file.save();
    res.json(file);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const files = await File.find({ groupId: req.params.groupId }).populate('uploadedBy', 'name');
    res.json(files);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
