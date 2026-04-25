const AppError = require("./AppError");

const isHttpUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const validateExtractBody = (body) => {
  const url = body?.url?.trim();

  if (!url) {
    throw new AppError("url is required.", 400);
  }

  if (!isHttpUrl(url)) {
    throw new AppError("url must be a valid http or https URL.", 400);
  }

  return { url };
};

const validateDownloadBody = (body) => {
  const { url } = validateExtractBody(body);
  const formatId = body?.format_id?.toString().trim();

  if (!formatId) {
    throw new AppError("format_id is required.", 400);
  }

  return {
    url,
    formatId,
  };
};

module.exports = {
  isHttpUrl,
  validateExtractBody,
  validateDownloadBody,
};