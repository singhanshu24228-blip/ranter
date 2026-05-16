import multer from "multer";

function fileFilter(_req, file, callback) {
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");

  if (isImage || isVideo) {
    callback(null, true);
    return;
  }

  callback(new Error("Only image and video uploads are allowed."));
}

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
