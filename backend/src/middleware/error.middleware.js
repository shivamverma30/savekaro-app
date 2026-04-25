const AppError = require("../utils/AppError");

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

const errorHandler = (error, req, res, next) => {
  const isJsonParseError = error?.type === "entity.parse.failed";
  const statusCode = Number(error.statusCode || error.status) || 500;
  const isOperational = error instanceof AppError || isJsonParseError || Boolean(error.isOperational);

  if (!isOperational) {
    console.error("Unexpected error:", error);
  }

  const payload = {
    success: false,
    message: isJsonParseError
      ? "Invalid JSON payload."
      : isOperational
      ? error.message
      : "Internal Server Error",
  };

  res.status(statusCode).json(payload);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};