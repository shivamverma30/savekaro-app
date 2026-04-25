const express = require("express");

const {
  extractVideoInfo,
  downloadVideo,
} = require("../controllers/downloader.controller");

const router = express.Router();

router.post("/extract", extractVideoInfo);
router.post("/download", downloadVideo);

module.exports = router;