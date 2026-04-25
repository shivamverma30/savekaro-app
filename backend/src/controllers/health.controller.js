const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "ALL Video Downloader API is running",
    data: {
      service: "ALL Video Downloader",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
};

module.exports = { getHealth };