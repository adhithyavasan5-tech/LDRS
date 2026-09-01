import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  UploadCloud,
  Film,
  Lock,
  CheckCircle2,
  Copy,
} from 'lucide-react';

import { roomService } from '../services/roomService';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const CreateRoom = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState(null);
  const [uploadStats, setUploadStats] = useState(null);

  const [formData, setFormData] = useState({
    roomName: '',
    password: '',
  });

  const [file, setFile] = useState(null);

  const [uploadedCloudData, setUploadedCloudData] = useState(null);
  const [uploadingFileName, setUploadingFileName] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];

    if (!selected) return;

    // Extension-based validation (case-insensitive, authoritative)
    const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv'];
    const ext = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Unsupported format "${ext}". Please use MP4, WebM, MOV, or MKV.`);
      return;
    }

    if (selected.size > 2 * 1024 * 1024 * 1024) {
      toast.error('Movie is too large. Maximum allowed size is 2 GB.');
      return;
    }

    setFile(selected);
    setUploadProgress(0);
    setChunkInfo(null);
    setUploadStats(null);
    
    // Reset previous upload data if a new file is picked
    if (uploadingFileName !== selected.name) {
      setUploadedCloudData(null);
      setUploadingFileName(selected.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.roomName || formData.roomName.length < 3) {
      return toast.error('Room name must be at least 3 chars');
    }

    if (!formData.password || formData.password.length < 4) {
      return toast.error('Password must be at least 4 chars');
    }

    if (!file) {
      return toast.error('Please select a movie file');
    }

    try {
      setLoading(true);
      setUploadProgress(0);
      setChunkInfo(null);
      setUploadStats(null);

      let uploadResult = uploadedCloudData;

      if (!uploadResult || uploadingFileName !== file.name) {
        // ============================================================
        // STEP 1 — UPLOAD MOVIE TO S3 (browser → S3 direct)
        // ============================================================

        setUploadPhase('uploading');

        console.log('[CreateRoom] Starting S3 multipart upload...');

        uploadResult = await roomService.uploadToS3Multipart(
          file,
          // Progress callback — same shape as before
          (progressData) => {
            if (!progressData) return;

            if (progressData.total) {
              const percentCompleted = Math.min(
                100,
                Math.round(
                  (progressData.loaded * 100) / progressData.total
                )
              );
              setUploadProgress(percentCompleted);
            }

            if (
              progressData.chunkIndex !== undefined &&
              progressData.totalChunks !== undefined
            ) {
              setChunkInfo({
                current: progressData.chunkIndex,
                total: progressData.totalChunks,
              });
            }

            const speedMBps = progressData.speedBytesPerSec
              ? (progressData.speedBytesPerSec / (1024 * 1024)).toFixed(2)
              : '0.00';

            const loadedMB = progressData.loaded
              ? (progressData.loaded / (1024 * 1024)).toFixed(2)
              : '0.00';

            const totalMB = progressData.total
              ? (progressData.total / (1024 * 1024)).toFixed(2)
              : '0.00';

            setUploadStats({
              speed: speedMBps,
              eta: progressData.etaSeconds || 0,
              loadedMB,
              totalMB,
            });
          }
        );

        // Verify we got a valid URL back
        if (!uploadResult?.secure_url) {
          throw new Error(
            'Movie upload completed but no video URL was returned.'
          );
        }

        setUploadedCloudData(uploadResult);
        setUploadingFileName(file.name);
      } else {
        console.log('[CreateRoom] Re-using previous upload data');
      }

      // ============================================================
      // STEP 3 — CREATE ROOM IN MONGODB
      // ============================================================

      setUploadPhase('creating');
      setUploadProgress(100);

      console.log('[CreateRoom] Creating room in backend...');

      const createRes = await roomService.createRoom({
        roomName: formData.roomName,
        password: formData.password,

        movieUrl: uploadResult.secure_url,
        moviePublicId: uploadResult.public_id,
        movieName: file.name,
        movieSize: file.size,
      });

      console.log('[CreateRoom] Room creation response:', createRes);

      if (!createRes?.success) {
        throw new Error(
          createRes?.message || 'Failed to create room'
        );
      }

      // ============================================================
      // SUCCESS
      // ============================================================

      toast.success('Room created successfully!');

      setCreatedRoom(createRes.room);

    } catch (err) {
      console.error('[CreateRoom] Room creation error:', err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create room';

      toast.error(message);

      setUploadProgress(0);
      setChunkInfo(null);
      setUploadStats(null);
    } finally {
      setLoading(false);
      setUploadPhase('');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      console.error('Clipboard error:', error);
      toast.error('Failed to copy');
    }
  };

  // ================================================================
  // ROOM CREATED SCREEN
  // ================================================================

  if (createdRoom) {
    return (
      <div className="page-container flex items-center justify-center min-h-[80vh] animate-scale-in">
        <div className="glass-card-strong max-w-md w-full p-8 text-center relative overflow-hidden">

          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-accent-500" />

          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-display font-semibold mb-2">
            Your Movie Date is Ready ❤️
          </h2>

          <p
            className="text-sm mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            Share these details with your partner.
          </p>

          <div className="space-y-4 mb-8">

            {/* ROOM CODE */}
            <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">

              <div className="text-left">
                <p className="text-xs text-primary-300 font-medium mb-1">
                  ROOM CODE
                </p>

                <p className="text-2xl font-mono tracking-widest">
                  {createdRoom.roomCode}
                </p>
              </div>

              <button
                onClick={() =>
                  copyToClipboard(createdRoom.roomCode)
                }
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Copy className="w-5 h-5" />
              </button>

            </div>

            {/* PASSWORD */}
            <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between">

              <div className="text-left">
                <p className="text-xs text-accent-300 font-medium mb-1">
                  PASSWORD
                </p>

                <p className="text-xl font-mono tracking-widest">
                  ••••••••
                </p>
              </div>

              <button
                onClick={() =>
                  copyToClipboard(formData.password)
                }
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Copy className="w-5 h-5" />
              </button>

            </div>

          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() =>
                navigate(`/watch/${createdRoom.roomCode}`)
              }
            >
              Enter Room Now
            </Button>
          </div>

        </div>
      </div>
    );
  }

  // ================================================================
  // CREATE ROOM FORM
  // ================================================================

  return (
    <div className="page-container max-w-2xl animate-fade-in">

      <div className="mb-8 text-center">
        <h1 className="page-title mb-2">
          Create a Movie Date
        </h1>

        <p className="page-subtitle">
          Upload your movie and set up a private room.
        </p>
      </div>

      <Card className="p-6 md:p-8">

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* ROOM NAME */}

          <Input
            label="Movie Date Name"
            name="roomName"
            placeholder="e.g. Friday Night Interstellar"
            value={formData.roomName}
            onChange={handleChange}
            leftIcon={<Film className="w-4 h-4" />}
          />

          {/* PASSWORD */}

          <Input
            label="Room Password"
            name="password"
            type="password"
            placeholder="Create a secret password"
            value={formData.password}
            onChange={handleChange}
            leftIcon={<Lock className="w-4 h-4" />}
          />

          {/* MOVIE FILE */}

          <div className="space-y-1.5">

            <label
              className="text-sm font-medium"
              style={{
                color: 'var(--text-secondary)',
              }}
            >
              Movie File
            </label>

            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />

            <div
              onClick={() =>
                !loading &&
                fileInputRef.current?.click()
              }
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                ${
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }
                ${
                  file
                    ? 'border-primary-500/50 bg-primary-500/5'
                    : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                }`}
            >

              {file ? (
                <div className="flex flex-col items-center">

                  <Film className="w-8 h-8 text-primary-400 mb-3" />

                  <p className="text-sm font-medium text-white truncate max-w-full px-4">
                    {file.name}
                  </p>

                  <p className="text-xs text-primary-300 mt-1">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>

                </div>
              ) : (
                <div className="flex flex-col items-center">

                  <UploadCloud className="w-8 h-8 text-gray-400 mb-3" />

                  <p className="text-sm font-medium text-gray-300">
                    Click to upload movie
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Supports MP4, WebM, MOV, MKV (Max 2 GB)
                  </p>

                </div>
              )}

            </div>
          </div>

          {/* SUBMIT + PROGRESS */}

          <div className="pt-4 border-t border-white/10">

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Create Room'}
            </Button>

            {loading && (
              <div className="mt-4 space-y-3">

                {/* STATUS */}

                <div className="text-center space-y-1">

                  <p className="font-medium text-primary-100 text-sm">

                    {uploadPhase === 'uploading' &&
                      uploadProgress < 100 &&
                      'Uploading movie...'}

                    {uploadPhase === 'uploading' &&
                      uploadProgress === 100 &&
                      'Finalizing upload...'}

                    {uploadPhase === 'creating' &&
                      'Creating movie room...'}

                  </p>

                  {/* CHUNK INFORMATION */}

                  {uploadPhase === 'uploading' &&
                    chunkInfo && (
                      <div className="text-xs text-primary-300 flex flex-col gap-0.5">

                        <p>
                          Chunk {chunkInfo.current}/
                          {chunkInfo.total}
                        </p>

                        <p>
                          {uploadProgress}%
                        </p>

                        {uploadStats && (
                          <>
                            <p>
                              {uploadStats.loadedMB} MB /{' '}
                              {uploadStats.totalMB} MB
                            </p>

                            <p>
                              Upload speed:{' '}
                              {uploadStats.speed} MB/s
                            </p>

                            <p>
                              Estimated remaining time:{' '}
                              {uploadStats.eta} seconds
                            </p>
                          </>
                        )}

                      </div>
                    )}

                </div>

                {/* PROGRESS BAR */}

                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">

                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width:
                        uploadPhase === 'creating'
                          ? '100%'
                          : `${uploadProgress}%`,
                    }}
                  />

                </div>

              </div>
            )}

          </div>

        </form>

      </Card>

    </div>
  );
};

export default CreateRoom;