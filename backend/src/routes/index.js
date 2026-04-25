const express = require("express");

const downloaderRoutes = require("./downloader.routes");
const healthRoutes = require("./health.routes");

const router = express.Router();

router.use("/", healthRoutes);
router.use("/api/v1/downloader", downloaderRoutes);

module.exports = router;