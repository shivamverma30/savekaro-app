const fs = require("fs");

const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { downloadByFormat, extractVideoData } = require("../services/ytDlp.service");
const { validateDownloadBody, validateExtractBody } = require("../utils/validation");

const extractVideoInfo = asyncHandler(async (req, res) => {
  const { url } = validateExtractBody(req.body);
  const data = await extractVideoData(url);

  res.status(200).json({
    success: true,
    ...data,
  });
});

const downloadVideo = asyncHandler(async (req, res, next) => {
  const { url, formatId } = validateDownloadBody(req.body);
  const { filePath, fileName, fileSize, metadata } = await downloadByFormat({
    url,
    formatId,
  });

  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    await fs.promises.unlink(filePath).catch(() => undefined);
  };

  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", fileSize);
  res.setHeader("X-Downloader-Extractor", metadata.extractor || "unknown");

  const fileStream = fs.createReadStream(filePath);

  fileStream.on("error", async () => {
    await cleanup();
    next(new AppError("Failed to read downloaded file.", 500));
  });

  res.on("finish", cleanup);
  res.on("close", cleanup);

  fileStream.pipe(res);
});

module.exports = {
  extractVideoInfo,
  downloadVideo,
};