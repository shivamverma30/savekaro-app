require("dotenv").config();

const app = require("./app");

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`ALL Video Downloader API listening on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down server gracefully...`);

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  shutdown("UnhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});