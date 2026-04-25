const cors = require("cors");
const express = require("express");

const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");
const { requestLogger } = require("./middleware/requestLogger.middleware");
const { apiRateLimiter } = require("./middleware/rateLimit.middleware");

const app = express();

const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set(["http://localhost:5173", ...configuredOrigins]));

const corsOptions = {
  origin: allowedOrigins,
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.disable("x-powered-by");

app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(apiRateLimiter);

app.use("/", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;