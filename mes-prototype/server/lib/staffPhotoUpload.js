import multer from 'multer';

const MAX_BYTES = Number(process.env.STAFF_PHOTO_MAX_BYTES) || 700_000;

export const staffPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('Photo must be an image (JPEG, PNG, or WebP)'));
      return;
    }
    cb(null, true);
  },
});
