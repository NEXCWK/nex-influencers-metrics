'use strict';

const supabase = require('../db/supabase');

const BUCKET = 'post-prints';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

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
async function uploadImage(buffer, mimeType, userId, postId, year, month, ext) {
  const paddedMonth = String(month).padStart(2, '0');
  const path = `${userId}/${year}/${paddedMonth}/${postId}.${ext}`;

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
 * Deletes a file from Supabase Storage.
 *
 * @param {string} path - The storage path to delete.
 * @returns {Promise<void>}
 */
async function deleteImage(path) {
  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

module.exports = { uploadImage, getSignedUrl, deleteImage };
