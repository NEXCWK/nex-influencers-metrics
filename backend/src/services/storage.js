'use strict';

const supabase = require('../db/supabase');

const BUCKET = 'post-prints';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

let bucketReady = false;

/**
 * Ensures the private `post-prints` bucket exists. Idempotent and cached after
 * the first successful check so it only hits the API once per process.
 */
async function ensureBucket() {
  if (bucketReady) return;

  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    bucketReady = true;
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ALLOWED_MIME,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
  });

  // Tolerate the race where another request created it first.
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Failed to create storage bucket: ${createError.message}`);
  }

  bucketReady = true;
}

/**
 * Uploads an image buffer to Supabase Storage.
 *
 * @param {Buffer} buffer - The raw image data.
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @param {string} userId
 * @param {string} postId
 * @param {string|number} year
 * @param {string|number} month - zero-padded or numeric
 * @param {string} ext - file extension without the dot (e.g. 'jpg')
 * @returns {Promise<string>} The storage path of the uploaded file.
 */
async function uploadImage(buffer, mimeType, userId, postId, year, month, ext, index = 0) {
  await ensureBucket();

  const paddedMonth = String(month).padStart(2, '0');
  // Prints are grouped in a per-post folder so a single post can hold many.
  const path = `${userId}/${year}/${paddedMonth}/${postId}/${index}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
}

/**
 * Generates a signed URL for a private storage object.
 *
 * @param {string} path - The storage path returned by uploadImage.
 * @returns {Promise<string>} A time-limited signed URL.
 */
async function getSignedUrl(path) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) {
    console.error(`Failed to create signed URL for "${path}":`, error.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Deletes a post's prints from Supabase Storage. Because every print of a post
 * lives in the same `.../{postId}/` folder, this removes the whole folder so
 * no orphan prints are left behind.
 *
 * @param {string} path - Any print path belonging to the post (e.g. image_url).
 * @returns {Promise<void>}
 */
async function deleteImage(path) {
  if (!path) return;

  // Derive the post folder from the file path (strip the file name).
  const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : path;

  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(folder);

  if (listError) {
    throw new Error(`Storage list failed: ${listError.message}`);
  }

  const paths = (files || []).map((f) => `${folder}/${f.name}`);
  // Fall back to the single path if the folder listing came back empty.
  const toRemove = paths.length > 0 ? paths : [path];

  const { error } = await supabase.storage.from(BUCKET).remove(toRemove);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

module.exports = { uploadImage, getSignedUrl, deleteImage, ensureBucket };
