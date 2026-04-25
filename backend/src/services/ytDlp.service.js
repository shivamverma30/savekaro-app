const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ytDlp = require("yt-dlp-exec");

const AppError = require("../utils/AppError");

const TEMP_DIR = path.join(__dirname, "..", "temp");
const DEFAULT_TEMP_MAX_AGE_MS = 60 * 60 * 1000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_WINDOWS = process.platform === "win32";
const IS_RENDER = Boolean(
  process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_EXTERNAL_HOSTNAME ||
    process.env.RENDER_INSTANCE_ID
);
const IS_LINUX_HOSTED = process.platform === "linux" || IS_RENDER;

const productionLog = (...args) => {
  if (IS_PRODUCTION) {
    console.log("[yt-dlp]", ...args);
  }
};

const productionError = (...args) => {
  if (IS_PRODUCTION) {
    console.error("[yt-dlp-error]", ...args);
  }
};

const ensureExecutablePermission = async (filePath) => {
  if (!filePath || IS_WINDOWS) {
    return false;
  }

  try {
    const stats = await fs.promises.stat(filePath);

    if ((stats.mode & 0o111) === 0) {
      await fs.promises.chmod(filePath, 0o755);
      productionLog(`Set executable permission on local yt-dlp binary: ${filePath}`);
    }

    return true;
  } catch (error) {
    productionLog(`Could not ensure executable permission for ${filePath}: ${error.message}`);
    return null;
  }
};

const resolveLocalYtDlpBinary = async () => {
  if (IS_WINDOWS) {
    return null;
  }

  try {
    const packageJsonPath = require.resolve("yt-dlp-exec/package.json");
    const packageRoot = path.dirname(packageJsonPath);
    const candidates = [
      path.join(packageRoot, "bin", "yt-dlp"),
      path.join(packageRoot, "dist", "yt-dlp"),
      path.join(packageRoot, ".bin", "yt-dlp"),
    ];

    for (const candidatePath of candidates) {
      try {
        await fs.promises.access(candidatePath, fs.constants.F_OK);
        await ensureExecutablePermission(candidatePath);
        productionLog(`Local yt-dlp binary detected: ${candidatePath}`);
        return candidatePath;
      } catch {
        continue;
      }
    }
  } catch (error) {
    productionLog(`Local yt-dlp binary lookup skipped: ${error.message}`);
  }

  return null;
};

const execFileAsync = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: 10 * 1024 * 1024, windowsHide: true, ...options },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
};

const ensureTempDir = async () => {
  await fs.promises.mkdir(TEMP_DIR, { recursive: true });
};

const sanitizeNamePart = (value, fallback = "file") => {
  const sanitized = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);

  return sanitized || fallback;
};

const sanitizeExtension = (value) => {
  const ext = String(value || "")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();

  return ext || "mp4";
};

const detectPlatform = (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("instagram.com")) {
      return "instagram";
    }

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "youtube";
    }

    if (hostname.includes("x.com") || hostname.includes("twitter.com")) {
      return "x";
    }

    if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) {
      return "facebook";
    }

    if (hostname.includes("vimeo.com")) {
      return "vimeo";
    }

    if (hostname.includes("tiktok.com")) {
      return "tiktok";
    }
  } catch {
    return "generic";
  }

  return "generic";
};

const isSslCertError = (message) => {
  return /ssl certificate_verify_failed|certificate verify failed|unable to get local issuer certificate|self signed certificate/i.test(
    String(message || "")
  );
};

const isTemporaryExtractorFailure = (message) => {
  return /timed out|timeout|network is unreachable|connection reset|temporary failure|service unavailable|http error 5\d\d|try again/i.test(
    String(message || "")
  );
};

const resolveCookieFile = async () => {
  const cookieCandidates = [
    path.join(__dirname, "..", "..", "cookies.txt"),
    path.join(__dirname, "..", "temp", "cookies.txt"),
  ];

  for (const cookiePath of cookieCandidates) {
    try {
      await fs.promises.access(cookiePath, fs.constants.R_OK);
      return cookiePath;
    } catch {
      continue;
    }
  }

  return null;
};

const buildReferer = (platform, url) => {
  if (platform === "instagram") {
    return "https://www.instagram.com/";
  }

  if (platform === "x") {
    return "https://x.com/";
  }

  if (platform === "facebook") {
    return "https://www.facebook.com/";
  }

  if (platform === "tiktok") {
    return "https://www.tiktok.com/";
  }

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {
    return "https://www.google.com/";
  }
};

const buildRequestOptions = async (url) => {
  const platform = detectPlatform(url);
  const referer = buildReferer(platform, url);
  const cookies = await resolveCookieFile();

  return {
    platform,
    options: {
      userAgent: DEFAULT_USER_AGENT,
      referer,
      addHeader: ["Accept-Language: en-US,en;q=0.9"],
      ...(cookies ? { cookies } : {}),
    },
  };
};

const createFriendlyDownloadError = (errorMessage, platform = "generic") => {
  const message = String(errorMessage || "");

  if (platform === "instagram") {
    if (/private|not available|this post is unavailable|not found/i.test(message)) {
      return new AppError("Private post cannot be downloaded.", 403);
    }

    if (/login required|please log in|checkpoint_required|challenge_required|consent_required/i.test(message)) {
      return new AppError("Login required for this content.", 403);
    }

    if (/rate limit|too many requests|429|feedback_required/i.test(message)) {
      return new AppError("Rate limited by Instagram. Please try again later.", 429);
    }

    if (/blocked|forbidden|restricted|denied|temporary/i.test(message)) {
      return new AppError("Temporary blocked by Instagram. Please retry in a few minutes.", 503);
    }
  }

  if (/private|login required|sign in|required to view|members only/i.test(message)) {
    return new AppError("Login required for this content.", 403);
  }

  if (/private|this video is private|account required/i.test(message)) {
    return new AppError("Private post cannot be downloaded.", 403);
  }

  if (/unsupported url|unsupported url format|no extractor|extractor error/i.test(message)) {
    return new AppError("Unsupported URL.", 400);
  }

  if (/network|timeout|timed out|temporary failure|connection refused|ssl certificate_verify_failed/i.test(message)) {
    return new AppError("Temporary network issue. Please try again.", 503);
  }

  if (/blocked|forbidden|captcha|rate limit|429/i.test(message)) {
    return new AppError("Platform blocked request.", 429);
  }

  return new AppError("Failed to process this link.", 400);
};

const parseYtDlpJson = (data) => {
  if (!data) {
    return null;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
};

const buildCommonCliArgs = (options = {}) => {
  const args = [
    "--no-warnings",
    "--no-playlist",
    "--prefer-free-formats",
    "--merge-output-format",
    "mp4",
    "--socket-timeout",
    "45",
    "--retries",
    "3",
  ];

  if (options.userAgent) {
    args.push("--user-agent", options.userAgent);
  }

  if (options.referer) {
    args.push("--referer", options.referer);
  }

  if (Array.isArray(options.addHeader)) {
    for (const header of options.addHeader) {
      args.push("--add-header", header);
    }
  }

  if (options.cookies) {
    args.push("--cookies", options.cookies);
  }

  if (options.noCheckCertificates) {
    args.push("--no-check-certificates");
  }

  return args;
};

const getFallbackCommands = async () => {
  if (!IS_LINUX_HOSTED) {
    return [];
  }

  await resolveLocalYtDlpBinary();

  return [
    {
      label: "npx yt-dlp",
      command: process.platform === "win32" ? "npx.cmd" : "npx",
      args: ["--yes", "yt-dlp"],
    },
    {
      label: "python3 -m yt_dlp",
      command: "python3",
      args: ["-m", "yt_dlp"],
    },
    {
      label: "yt-dlp from PATH",
      command: "yt-dlp",
      args: [],
    },
  ];
};

const runCliCommand = async ({ command, args, url, options, mode }) => {
  const cliArgs = [
    ...args,
    ...buildCommonCliArgs(options),
    ...(mode === "extract" ? ["--dump-single-json", "--skip-download"] : []),
    ...(mode === "download"
      ? ["-f", options.format, "-o", options.output, "--restrict-filenames", "--force-overwrites"]
      : []),
    url,
  ].filter(Boolean);

  productionLog(`Trying fallback command: ${command}`, cliArgs.slice(0, 12));
  return execFileAsync(command, cliArgs);
};

const isEnoentError = (error) => {
  return String(error?.code || "").toUpperCase() === "ENOENT" || /ENOENT/i.test(String(error?.message || ""));
};

const normalizeCommandError = (error) => {
  const stderr = String(error?.stderr || "").trim();
  const stdout = String(error?.stdout || "").trim();
  return (stderr || stdout || error?.message || "yt-dlp command failed").toString().trim();
};

const runFallbacks = async ({ url, options, platform, mode }) => {
  const fallbacks = await getFallbackCommands();

  for (const fallback of fallbacks) {
    try {
      const result = await runCliCommand({
        command: fallback.command,
        args: fallback.args,
        url,
        options,
        mode,
      });

      productionLog(`Fallback succeeded: ${fallback.label}`);
      return mode === "extract" ? result.stdout : result;
    } catch (error) {
      const errorMessage = normalizeCommandError(error);
      productionError(`Fallback failed: ${fallback.label}`, errorMessage.substring(0, 200));

      if (!isEnoentError(error) && !/not found|command not found|spawn/i.test(errorMessage)) {
        throw createFriendlyDownloadError(errorMessage, platform);
      }
    }
  }

  throw new AppError("Unable to locate a working yt-dlp executable on this server.", 503);
};

const runYtDlpRaw = async (url, options) => {
  const baseOptions = {
    noWarnings: true,
    noPlaylist: true,
    preferFreeFormats: true,
    mergeOutputFormat: "mp4",
    socketTimeout: 45,
    retries: 3,
    ...options,
  };

  productionLog("Calling yt-dlp default invocation:", {
    url: url.substring(0, 50) + "...",
    timeout: baseOptions.socketTimeout,
    render: IS_RENDER,
  });

  return ytDlp(url, baseOptions);
};

const runYtDlp = async (url, options, platform) => {
  let temporaryRetried = false;
  let sslRetried = false;
  let extractRetried = false;
  const isExtractMode = Boolean(options.dumpSingleJson);

  try {
    while (true) {
      try {
        return await runYtDlpRaw(url, {
          ...options,
        });
      } catch (error) {
        const errorMessage = (error?.stderr || error?.message || "yt-dlp command failed")
          .toString()
          .trim();

        if (IS_WINDOWS) {
          if (!sslRetried && isSslCertError(errorMessage)) {
            sslRetried = true;
            productionLog("SSL certificate error on Windows, retrying without verification...");
            continue;
          }

          throw createFriendlyDownloadError(errorMessage, platform);
        }

        if (isEnoentError(error) || /spawn .*ENOENT/i.test(errorMessage)) {
          productionLog("Default invocation failed with ENOENT, trying fallbacks");
          return runFallbacks({
            url,
            options,
            platform,
            mode: isExtractMode ? "extract" : "download",
          });
        }

        if (isExtractMode && IS_LINUX_HOSTED && !extractRetried) {
          extractRetried = true;
          productionLog("Retrying extract once on Linux/Render", errorMessage.substring(0, 100));
          continue;
        }

        if (!temporaryRetried && isTemporaryExtractorFailure(errorMessage)) {
          temporaryRetried = true;
          productionLog("Temporary extraction failure, retrying...", errorMessage.substring(0, 100));
          continue;
        }

        const friendlyError = createFriendlyDownloadError(errorMessage, platform);
        productionError("Final error after retries:", {
          message: friendlyError.message,
          statusCode: friendlyError.statusCode,
          originalMessage: errorMessage.substring(0, 150),
        });
        throw friendlyError;
      }
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const errorMessage = (error?.stderr || error?.message || "yt-dlp command failed")
      .toString()
      .trim();

    const friendlyError = createFriendlyDownloadError(errorMessage, platform);
    productionError("Unhandled error:", {
      message: friendlyError.message,
      statusCode: friendlyError.statusCode,
    });
    throw friendlyError;
  }
};

const buildResolution = (format) => {
  if (format.resolution && format.resolution !== "unknown") {
    return format.resolution;
  }

  if (format.width && format.height) {
    return `${format.width}x${format.height}`;
  }

  if (format.vcodec === "none") {
    return "audio";
  }

  return "unknown";
};

const buildQuality = (format) => {
  return (
    format.format_note ||
    format.quality ||
    format.format ||
    (format.vcodec === "none" ? "audio" : "video")
  );
};

const isUsableFormat = (format) => {
  const hasId = format?.format_id !== undefined && String(format.format_id).trim() !== "";
  const hasMedia = format?.vcodec !== "none" || format?.acodec !== "none";
  const hasExt = Boolean(format?.ext && String(format.ext).trim() !== "");
  const hasSource = Boolean(format?.url || format?.manifest_url || format?.fragment_base_url);

  return hasId && hasMedia && hasExt && hasSource;
};

const mapFormat = (format) => ({
  format_id: String(format.format_id),
  ext: String(format.ext),
  quality: buildQuality(format),
  resolution: buildResolution(format),
  filesize: format.filesize || format.filesize_approx || null,
});

const sortFormats = (formats) => {
  return formats.sort((a, b) => {
    const aHeight = Number.parseInt(a.resolution.split("x")[1], 10) || 0;
    const bHeight = Number.parseInt(b.resolution.split("x")[1], 10) || 0;

    if (bHeight !== aHeight) {
      return bHeight - aHeight;
    }

    return (b.filesize || 0) - (a.filesize || 0);
  });
};

const dedupeFormats = (formats) => {
  const seen = new Set();

  return formats.filter((format) => {
    const key = [format.format_id, format.ext, format.quality, format.resolution].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const normalizeInfo = (info) => {
  const entry = Array.isArray(info?.entries) && info.entries.length > 0 ? info.entries[0] : info;
  const mappedFormats = Array.isArray(entry?.formats)
    ? sortFormats(dedupeFormats(entry.formats.filter(isUsableFormat).map(mapFormat)))
    : [];

  return {
    title: entry?.title || null,
    thumbnail: entry?.thumbnail || null,
    duration: entry?.duration || null,
    uploader: entry?.uploader || null,
    extractor: entry?.extractor || null,
    formats: mappedFormats,
  };
};

const extractVideoData = async (url) => {
  const requestOptions = await buildRequestOptions(url);

  const extractOptions = {
    dumpSingleJson: true,
    skipDownload: true,
    noPlaylist: true,
    flatPlaylist: false,
    ...requestOptions.options,
  };

  const rawInfo = await runYtDlp(url, extractOptions, requestOptions.platform);

  const info = parseYtDlpJson(rawInfo);

  if (!info) {
    throw new AppError("Failed to parse extractor response.", 500);
  }

  const normalized = normalizeInfo(info);

  if (!normalized.title) {
    throw new AppError("Could not extract media details for this URL.", 400);
  }

  return normalized;
};

const cleanupOldTempFiles = async (maxAgeMs = DEFAULT_TEMP_MAX_AGE_MS) => {
  await ensureTempDir();

  const now = Date.now();
  const entries = await fs.promises.readdir(TEMP_DIR, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const absolutePath = path.join(TEMP_DIR, entry.name);
        const stats = await fs.promises.stat(absolutePath);

        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(absolutePath).catch(() => undefined);
        }
      })
  );
};

const resolveDownloadedFile = async (filenamePrefix) => {
  const entries = await fs.promises.readdir(TEMP_DIR, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.startsWith(`${filenamePrefix}.`)) {
      continue;
    }

    if (entry.name.endsWith(".part") || entry.name.endsWith(".ytdl")) {
      continue;
    }

    const absolutePath = path.join(TEMP_DIR, entry.name);
    const stats = await fs.promises.stat(absolutePath);
    candidates.push({ absolutePath, mtimeMs: stats.mtimeMs, size: stats.size });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
};

const downloadByFormat = async ({ url, formatId }) => {
  await ensureTempDir();
  await cleanupOldTempFiles();

  const metadata = await extractVideoData(url);
  const requestOptions = await buildRequestOptions(url);
  const downloadTitle = sanitizeNamePart(metadata.title, "video");
  const token = crypto.randomBytes(4).toString("hex");
  const safeFormat = sanitizeNamePart(formatId, "format");
  const filenamePrefix = `${downloadTitle}-${safeFormat}-${token}`;
  const outputTemplate = path.join(TEMP_DIR, `${filenamePrefix}.%(ext)s`);

  const downloadOptions = {
    format: formatId,
    output: outputTemplate,
    noPlaylist: true,
    restrictFilenames: true,
    forceOverwrites: true,
    ...requestOptions.options,
  };

  await runYtDlp(url, downloadOptions, requestOptions.platform);

  const downloadedFile = await resolveDownloadedFile(filenamePrefix);

  if (!downloadedFile) {
    throw new AppError("Downloaded file was not found in temp storage.", 500);
  }

  const downloadedExtension = sanitizeExtension(path.extname(downloadedFile.absolutePath));
  const finalFileName = `${downloadTitle} - SV Downloader.${downloadedExtension}`;

  return {
    filePath: downloadedFile.absolutePath,
    fileName: finalFileName,
    fileSize: downloadedFile.size,
    metadata,
  };
};

module.exports = {
  TEMP_DIR,
  cleanupOldTempFiles,
  downloadByFormat,
  extractVideoData,
};