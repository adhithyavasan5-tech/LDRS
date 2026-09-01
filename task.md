# LDRS S3 Temporary Uploads & Watch Together Lifecycle Checklist

- `[x]` 1. **Movie Size Limit & Extension Validation**
  - `[x]` Upgraded limits to 2 GB (`2 * 1024 * 1024 * 1024` bytes) in `CreateRoom.jsx` and `uploadController.js`
  - `[x]` User friendly error message `Movie is too large. Maximum allowed size is 2 GB.` shown on oversize file selection
  - `[x]` Standardized case-insensitive format validation for `.mp4`, `.webm`, `.mov`, `.mkv`

- `[x]` 2. **DB S3 Upload Tracking (`UploadSession.js`)**
  - `[x]` Created MongoDB `UploadSession` schema to record uploads in progress
  - `[x]` Captured `uploadId`, `movieObjectKey`, `movieName`, `movieSize`, `ownerId`, `expiresAt`, `roomId`
  - `[x]` Tied completed upload session validation to room creation, preventing spoofing (User A -> Room B)

- `[x]` 3. **Secure Movie Access (Short-lived signed URLs)**
  - `[x]` Added room membership checks to `getRoomByCode` to restrict access to authenticated members (creator/partner)
  - `[x]` Configured server-side generation of short-lived S3 signed GET URLs for movie streaming
  - `[x]` Replaced plain raw movie URLs with short-lived presigned URLs in `joinRoom` and `getRoomByCode` responses

- `[x]` 4. **Room Disconnect Deletion Grace Period**
  - `[x]` Monitored socket disconnects & leaves in `roomSocket.js`
  - `[x]` Programmed a 3-minute grace period (180 seconds) when active room membership counts fall to 0
  - `[x]` Handled socket reconnects to cancel scheduled room/movie deletion if users return
  - `[x]` Triggered S3 `DeleteObjectCommand` and MongoDB Room purging once grace period expires

- `[x]` 5. **Abandoned Uploads Cleaner**
  - `[x]` Implemented background setInterval script to check for expired and abandoned upload sessions
  - `[x]` Instructed task to abort S3 multipart sessions, remove partial files, and delete DB tracking entries

- `[x]` 6. **Environment Hardening**
  - `[x]` Added root `.gitignore` to prevent any config file leakages
  - `[x]` Documented placeholder environment variables in `.env.example`
