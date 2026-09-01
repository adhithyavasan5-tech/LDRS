import api from './api';
import axios from 'axios';

export const roomService = {
  /**
   * Get secure signature for direct Cloudinary upload
   */
  getUploadSignature: async () => {
    const res = await api.get('/rooms/upload-signature');
    return res.data;
  },

  /**
   * Direct chunked upload to Cloudinary
   *
   * Features:
   * - 25 MB chunks for better stability
   * - 3 retries per chunk
   * - Fresh FormData for every retry
   * - 10-minute timeout per chunk
   * - Accurate cumulative upload progress
   * - Upload speed calculation
   * - ETA calculation
   * - Support resuming from failed chunks
   */
  uploadToCloudinaryDirect: async (
    file,
    signatureData,
    onProgress,
    resumeState = null,
    onStateChange = null
  ) => {
    const chunkSize = 25 * 1024 * 1024; // 25 MB

    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / chunkSize);

    const uniqueUploadId =
      resumeState?.uniqueUploadId ||
      'ldrs_' +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);

    console.log(`[Upload] File size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`[Upload] Chunk size: ${(chunkSize / (1024 * 1024)).toFixed(0)} MB`);
    console.log(`[Upload] Total chunks: ${totalChunks}`);
    console.log(`[Upload] Upload ID: ${uniqueUploadId}`);

    let start = resumeState?.start || 0;
    let chunkIndex = resumeState?.chunkIndex || 0;
    let finalResponse = null;

    const startTime = Date.now();

    while (start < totalSize) {
      if (onStateChange) {
        onStateChange({ uniqueUploadId, start, chunkIndex });
      }
      chunkIndex++;

      const end = Math.min(
        start + chunkSize - 1,
        totalSize - 1
      );

      const currentChunkStart = start;

      console.log(`[Upload] Chunk ${chunkIndex}/${totalChunks} started`);

      let retries = 5; // Increased retries for network resilience
      let response = null;

      while (retries > 0) {
        try {
          /*
           * Create a fresh FormData for every attempt.
           * This prevents problems when Axios retries
           * a previously consumed FormData stream.
           */
          const formData = new FormData();

          formData.append(
            'api_key',
            signatureData.apiKey
          );

          formData.append(
            'timestamp',
            signatureData.timestamp
          );

          formData.append(
            'signature',
            signatureData.signature
          );

          formData.append(
            'folder',
            signatureData.folder
          );

          /*
           * Create the current chunk.
           */
          const chunk = file.slice(
            start,
            end + 1
          );

          /*
           * IMPORTANT:
           * Keep file as the LAST FormData field.
           */
          formData.append(
            'file',
            chunk,
            file.name
          );

          const headers = {
            'X-Unique-Upload-Id': uniqueUploadId,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          };

          response = await axios.post(
            `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/video/upload`,
            formData,
            {
              headers,

              /*
               * Allow slow connections plenty of time.
               */
              timeout: 600000,

              /*
               * Upload progress.
               */
              onUploadProgress: (progressEvent) => {
                if (
                  !onProgress ||
                  !progressEvent.loaded
                ) {
                  return;
                }

                const chunkBytes =
                  end -
                  currentChunkStart +
                  1;

                const chunkLoaded = Math.min(
                  progressEvent.loaded,
                  chunkBytes
                );

                const overallLoaded = Math.min(
                  currentChunkStart +
                    chunkLoaded,
                  totalSize
                );

                const elapsedSeconds =
                  (Date.now() -
                    startTime) /
                  1000;

                const speedBytesPerSec =
                  elapsedSeconds > 0
                    ? overallLoaded /
                      elapsedSeconds
                    : 0;

                const remainingBytes =
                  totalSize -
                  overallLoaded;

                const etaSeconds =
                  speedBytesPerSec > 0
                    ? Math.ceil(
                        remainingBytes /
                          speedBytesPerSec
                      )
                    : 0;

                onProgress({
                  loaded: overallLoaded,
                  total: totalSize,
                  chunkIndex,
                  totalChunks,
                  speedBytesPerSec,
                  etaSeconds,
                });
              },
            }
          );

          /*
           * Chunk successfully uploaded.
           */
          console.log(`[Upload] Chunk ${chunkIndex}/${totalChunks} completed`);

          const overallLoaded = Math.min(
            end + 1,
            totalSize
          );

          const elapsedSeconds =
            (Date.now() -
              startTime) /
            1000;

          const speedBytesPerSec =
            elapsedSeconds > 0
              ? overallLoaded /
                elapsedSeconds
              : 0;

          const remainingBytes =
            totalSize -
            overallLoaded;

          const etaSeconds =
            speedBytesPerSec > 0
              ? Math.ceil(
                  remainingBytes /
                    speedBytesPerSec
                )
              : 0;

          console.log(`[Upload] Overall progress: ${Math.round((overallLoaded / totalSize) * 100)}%`);
          console.log(`[Upload] Speed: ${(speedBytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`);
          console.log(`[Upload] ETA: ${etaSeconds} seconds`);

          /*
           * Send final progress update.
           */
          if (onProgress) {
            onProgress({
              loaded: overallLoaded,
              total: totalSize,
              chunkIndex,
              totalChunks,
              speedBytesPerSec,
              etaSeconds,
            });
          }

          /*
           * Stop retry loop.
           */
          break;

        } catch (err) {
          const status = err.response?.status;
          const cloudinaryError =
            err.response?.data?.error?.message ||
            err.message ||
            'Unknown upload error';

          // Fatal errors: 400, 401, 403, 404. Don't retry these (e.g. 100MB account limit)
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            console.error(`[Upload] Fatal error ${status} on chunk ${chunkIndex}:`, cloudinaryError);
            throw new Error(`Cloudinary Error (${status}): ${cloudinaryError}`);
          }

          retries--;

          console.error(
            `[Upload] Chunk ${chunkIndex}/${totalChunks} failed. Retries left: ${retries}`,
            err
          );

          if (retries === 0) {
            throw new Error(
              `Network error: Failed to upload chunk ${chunkIndex}/${totalChunks} after multiple attempts.`
            );
          }

          console.log(
            `[Upload] Retrying chunk ${chunkIndex}/${totalChunks} in 3 seconds...`
          );

          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      /*
       * Cloudinary returns the final upload
       * information with the last chunk.
       */
      if (
        end === totalSize - 1 &&
        response
      ) {
        finalResponse = response.data;
      }

      /*
       * Move to the next chunk.
       */
      start = end + 1;
    }

    console.log('[Upload] Cloudinary upload completed');
    console.log(`[Upload] Secure URL: ${finalResponse?.secure_url}`);

    return finalResponse;
  },

  /**
   * S3 Multipart Upload — browser-to-S3 direct upload
   *
   * Flow:
   * 1. POST /api/rooms/upload/start    → get uploadId + key
   * 2. For each chunk:
   *    POST /api/rooms/upload/sign-chunk → get presigned URL
   *    PUT  presignedUrl with chunk      → get ETag from response header
   * 3. POST /api/rooms/upload/complete  → finalize, get secure_url
   *
   * Features:
   * - 25 MB chunks
   * - 5 retries per chunk
   * - Upload progress, speed, ETA
   * - ETag collection for CompleteMultipartUpload
   * - Abort support
   * - Movie bytes never go through Express
   */
  uploadToS3Multipart: async (file, onProgress) => {
    const CHUNK_SIZE = 25 * 1024 * 1024; // 25 MB
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    console.log(`[Upload] File size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`[Upload] Chunk size: ${(CHUNK_SIZE / (1024 * 1024)).toFixed(0)} MB`);
    console.log(`[Upload] Total chunks: ${totalChunks}`);

    // ── Step 1: Start multipart upload on server ──────────────────
    const startRes = await api.post('/rooms/upload/start', {
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
    }, { timeout: 600000 });

    if (!startRes.data?.success) {
      throw new Error(startRes.data?.message || 'Failed to start upload');
    }

    const { uploadId, key } = startRes.data;
    console.log(`[Upload] Upload ID: ${uploadId}`);
    console.log(`[Upload] S3 Key: ${key}`);

    const parts = []; // { PartNumber, ETag }
    const startTime = Date.now();

    // ── Step 2: Upload each chunk directly to S3 ──────────────────
    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBlob = file.slice(start, end);

      console.log(`[Upload] Chunk ${partNumber}/${totalChunks} started`);

      let retries = 5;
      let etag = null;

      while (retries > 0) {
        try {
          // Get presigned URL from our backend
          const signRes = await api.post('/rooms/upload/sign-chunk', {
            uploadId,
            key,
            partNumber,
          }, { timeout: 600000 });

          if (!signRes.data?.success) {
            throw new Error(signRes.data?.message || 'Failed to get signed URL');
          }

          const { signedUrl } = signRes.data;

          // Upload chunk directly to S3 (browser → S3, bypasses Express)
          const putRes = await axios.put(signedUrl, chunkBlob, {
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            timeout: 600000, // 10 min per chunk

            onUploadProgress: (progressEvent) => {
              if (!onProgress || !progressEvent.loaded) return;

              const chunkLoaded = Math.min(progressEvent.loaded, end - start);
              const overallLoaded = Math.min(start + chunkLoaded, totalSize);

              const elapsedSeconds = (Date.now() - startTime) / 1000;
              const speedBytesPerSec = elapsedSeconds > 0 ? overallLoaded / elapsedSeconds : 0;
              const remainingBytes = totalSize - overallLoaded;
              const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

              onProgress({
                loaded: overallLoaded,
                total: totalSize,
                chunkIndex: partNumber,
                totalChunks,
                speedBytesPerSec,
                etaSeconds,
              });
            },
          });

          // Extract ETag from S3 response headers
          etag = putRes.headers?.etag || putRes.headers?.ETag;
          if (etag) {
            // Remove surrounding quotes if present
            etag = etag.replace(/"/g, '');
          }

          console.log(`[Upload] Chunk ${partNumber}/${totalChunks} completed (ETag: ${etag})`);

          // Log overall progress
          const overallLoaded = Math.min(end, totalSize);
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const speedBytesPerSec = elapsedSeconds > 0 ? overallLoaded / elapsedSeconds : 0;
          const remainingBytes = totalSize - overallLoaded;
          const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

          console.log(`[Upload] Overall progress: ${Math.round((overallLoaded / totalSize) * 100)}%`);
          console.log(`[Upload] Speed: ${(speedBytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`);
          console.log(`[Upload] ETA: ${etaSeconds} seconds`);

          if (onProgress) {
            onProgress({
              loaded: overallLoaded,
              total: totalSize,
              chunkIndex: partNumber,
              totalChunks,
              speedBytesPerSec,
              etaSeconds,
            });
          }

          break; // Success — exit retry loop

        } catch (err) {
          const status = err.response?.status;

          // Fatal 4xx errors — don't retry
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            console.error(`[Upload] Fatal error ${status} on chunk ${partNumber}:`, err.message);

            // Abort the multipart upload to clean up
            try {
              await api.post('/rooms/upload/abort', { uploadId, key }, { timeout: 600000 });
              console.log('[Upload] Aborted multipart upload after fatal error');
            } catch (abortErr) {
              console.error('[Upload] Failed to abort:', abortErr.message);
            }

            throw new Error(`Upload failed (${status}): ${err.response?.data?.message || err.message}`);
          }

          retries--;
          console.error(`[Upload] Chunk ${partNumber}/${totalChunks} failed. Retries left: ${retries}`, err.message);

          if (retries === 0) {
            // Abort the multipart upload
            try {
              await api.post('/rooms/upload/abort', { uploadId, key }, { timeout: 600000 });
              console.log('[Upload] Aborted multipart upload after retries exhausted');
            } catch (abortErr) {
              console.error('[Upload] Failed to abort:', abortErr.message);
            }

            throw new Error(`Upload failed: Chunk ${partNumber}/${totalChunks} failed after 5 attempts.`);
          }

          console.log(`[Upload] Retrying chunk ${partNumber}/${totalChunks} in 3 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      if (!etag) {
        // Abort — ETag is required
        try {
          await api.post('/rooms/upload/abort', { uploadId, key }, { timeout: 600000 });
        } catch (abortErr) {
          console.error('[Upload] Failed to abort:', abortErr.message);
        }
        throw new Error(`Upload failed: Missing ETag for chunk ${partNumber}`);
      }

      parts.push({ PartNumber: partNumber, ETag: etag });
    }

    // Ensure parts are explicitly sorted by PartNumber before completion
    const sortedParts = parts.slice().sort((a, b) => a.PartNumber - b.PartNumber);

    // ── Step 3: Complete multipart upload ──────────────────────────
    console.log('[Upload] All chunks uploaded. Completing multipart upload...');

    const completeRes = await api.post('/rooms/upload/complete', {
      uploadId,
      key,
      parts: sortedParts,
    }, { timeout: 600000 });

    if (!completeRes.data?.success) {
      throw new Error(completeRes.data?.message || 'Failed to complete upload');
    }

    console.log('[Upload] S3 upload completed');
    console.log(`[Upload] Secure URL: ${completeRes.data.secure_url}`);

    return {
      secure_url: completeRes.data.secure_url,
      public_id: completeRes.data.public_id,
    };
  },

  /**
   * Abort an in-progress S3 multipart upload
   */
  abortS3Upload: async (uploadId, key) => {
    const res = await api.post('/rooms/upload/abort', { uploadId, key }, { timeout: 600000 });
    return res.data;
  },

  /**
   * Create a new movie date room
   * Accepts JSON payload
   * Movie is already uploaded to S3 or Cloudinary.
   */
  createRoom: async (payload) => {
    const res = await api.post(
      '/rooms/create',
      payload
    );

    return res.data;
  },

  /**
   * Join a room by code and password
   */
  joinRoom: async (data) => {
    const res = await api.post(
      '/rooms/join',
      data
    );

    return res.data;
  },

  /**
   * Get room info by room code
   */
  getRoomByCode: async (code) => {
    const res = await api.get(
      `/rooms/${code}`
    );

    return res.data;
  },

  /**
   * Leave a room
   */
  leaveRoom: async (roomId) => {
    const res = await api.post(
      `/rooms/${roomId}/leave`
    );

    return res.data;
  },
};