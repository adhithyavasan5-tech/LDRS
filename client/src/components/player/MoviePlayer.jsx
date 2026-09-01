import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return `${m}:${String(s).padStart(2, '0')}`;
};

const MoviePlayer = ({
  url,
  title,
  socket,
  roomCode,
  initialPosition = 0,
  initialIsPlaying = false,
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  /*
   * IMPORTANT
   *
   * This flag is true ONLY while we are applying a command
   * received from the other person.
   *
   * We do NOT use a timeout to reset it.
   */
  const applyingRemoteUpdate = useRef(false);

  /*
   * Used to prevent duplicate play/pause operations while
   * the browser is still processing video.play().
   */
  const playRequestRef = useRef(null);

  /*
   * Used when the video source changes.
   */
  const sourceVersionRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [showControls, setShowControls] = useState(true);

  // =========================================================
  // UPDATE UI TIME
  // =========================================================

  const updateTimeUI = useCallback((time) => {
    const video = videoRef.current;

    if (!video) return;

    const safeTime = Number.isFinite(time) ? time : 0;

    setCurrentTime(safeTime);

    if (
      Number.isFinite(video.duration) &&
      video.duration > 0
    ) {
      setProgress(
        Math.min(
          100,
          Math.max(
            0,
            (safeTime / video.duration) * 100
          )
        )
      );
    }
  }, []);

  // =========================================================
  // CONTROL AUTO HIDE
  // =========================================================

  const handleMouseMove = () => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      if (playRequestRef.current) {
        playRequestRef.current = null;
      }
    };
  }, []);

  // =========================================================
  // INITIAL ROOM STATE
  // =========================================================

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const version = sourceVersionRef.current;

    const applyInitialState = async () => {
      if (version !== sourceVersionRef.current) return;

      applyingRemoteUpdate.current = true;

      try {
        if (
          Number.isFinite(initialPosition) &&
          initialPosition >= 0
        ) {
          try {
            video.currentTime = initialPosition;
            updateTimeUI(initialPosition);
          } catch (err) {
            console.warn('Initial seek failed:', err);
          }
        }

        if (initialIsPlaying) {
          try {
            const request = video.play();

            playRequestRef.current = request;

            await request;

            if (playRequestRef.current === request) {
              setIsPlaying(true);
            }
          } catch (err) {     /*
             * Autoplay may be blocked by the browser.
             * This is NOT a fatal error.
             */
            if (err?.name !== 'AbortError') {
              console.log(
                'Autoplay blocked. Press Play to start.'
              );
            }
          }
        }
      } finally {
        if (version === sourceVersionRef.current) {
          applyingRemoteUpdate.current = false;
        }
      }
    };

    if (video.readyState >= 1) {
      applyInitialState();
    } else {
      video.addEventListener(
        'loadedmetadata',
        applyInitialState,
        { once: true }
      );

      return () => {
        video.removeEventListener(
          'loadedmetadata',
          applyInitialState
        );
      };
    }
  }, [
    initialPosition,
    initialIsPlaying,
    url,
    updateTimeUI,
  ]);

  // =========================================================
  // SOCKET: REMOTE PLAY
  // =========================================================

  useEffect(() => {
    if (!socket) return;

    const handleRemotePlay = async (data) => {
      const video = videoRef.current;

      if (!video) return;

      console.log('[MoviePlayer] Remote PLAY', data);

      /*
       * Ignore our own event if the server ever broadcasts it.
       */
      if (
        data?.initiatedBy &&
        socket.id &&
        data.initiatedBy === socket.id
      ) {
        return;
      }

      applyingRemoteUpdate.current = true;

      try {
        if (
          Number.isFinite(data?.position)
        ) {
          try {
            video.currentTime = data.position;
            updateTimeUI(data.position);
          } catch (err) {
            console.warn(
              '[MoviePlayer] Remote seek before play failed:',
              err
            );
          }
        }

        /*
         * If a previous play request is still pending,
         * don't create another one.
         */
        if (playRequestRef.current) {
          try {
            await playRequestRef.current;
          } catch {
            // Ignore old play request failure.
          }
        }

        if (video.paused) {
          const request = video.play();

          playRequestRef.current = request;

          try {
            await request;
          } catch (err) {
            /*
             * AbortError can happen if the browser receives
             * another video command immediately.
             * Do not show it as a fatal player error.
             */
            if (err?.name !== 'AbortError') {
              console.warn(
                '[MoviePlayer] Remote play failed:',
                err
              );
            }
          } finally {
            if (playRequestRef.current === request) {
              playRequestRef.current = null;
            }
          }
        }
      } finally {
        /*
         * Reset ONLY after the remote operation has finished.
         */
        applyingRemoteUpdate.current = false;
      }
    };

    socket.on('playback:play', handleRemotePlay);

    return () => {
      socket.off('playback:play', handleRemotePlay);
    };
  }, [socket, updateTimeUI]);

  // =========================================================
  // SOCKET: REMOTE PAUSE
  // =========================================================

  useEffect(() => {
    if (!socket) return;

    const handleRemotePause = (data) => {
      const video = videoRef.current;

      if (!video) return;

      console.log('[MoviePlayer] Remote PAUSE', data);

      if (
        data?.initiatedBy &&
        socket.id &&
        data.initiatedBy === socket.id
      ) {
        return;
      }

      applyingRemoteUpdate.current = true;

      try {
        // Cancel any pending play request.
        playRequestRef.current = null;

        if (!video.paused) {
          video.pause();
        }

        if (
          Number.isFinite(data?.position)
        ) {
          try {
            video.currentTime = data.position;
            updateTimeUI(data.position);
          } catch (err) {
            console.warn(
              '[MoviePlayer] Remote pause seek failed:',
              err
            );
          }
        }

        setIsPlaying(false);
      } finally {
        /*
         * This operation is synchronous, so it is safe to
         * release the flag immediately.
         */
        applyingRemoteUpdate.current = false;
      }
    };

    socket.on('playback:pause', handleRemotePause);

    return () => {
      socket.off('playback:pause', handleRemotePause);
    };
  }, [socket, updateTimeUI]);

  // =========================================================
  // SOCKET: REMOTE SEEK
  // =========================================================

  useEffect(() => {
    if (!socket) return;

    const handleRemoteSeek = (data) => {
      const video = videoRef.current;

      if (!video) return;

      console.log('[MoviePlayer] Remote SEEK', data);

      if (
        data?.initiatedBy &&
        socket.id &&
        data.initiatedBy === socket.id
      ) {
        return;
      }

      if (!Number.isFinite(data?.position)) {
        return;
      }

      applyingRemoteUpdate.current = true;

      try {
        const newPosition = Math.max(
          0,
          data.position
        );

        if (
          Number.isFinite(video.duration) &&
          video.duration > 0
        ) {
          video.currentTime = Math.min(
            newPosition,
            video.duration
          );
        } else {
          video.currentTime = newPosition;
        }

        updateTimeUI(newPosition);
      } catch (err) {
        console.warn(
          '[MoviePlayer] Remote seek failed:',
          err
        );
      } finally {
        applyingRemoteUpdate.current = false;
      }
    };

    socket.on('playback:seek', handleRemoteSeek);

    return () => {
      socket.off('playback:seek', handleRemoteSeek);
    };
  }, [socket, updateTimeUI]);

  // =========================================================
  // VIDEO EVENTS
  // =========================================================

  const handleTimeUpdate = () => {
    const video = videoRef.current;

    if (!video) return;

    updateTimeUI(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;

    if (!video) return;

    if (Number.isFinite(video.duration)) {
      setDuration(video.duration);
    }

    setError(null);
  };

  const handleLoadedData = () => {
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    setIsBuffering(true);
  };

  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    setError(null);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setIsBuffering(false);
  };

  const handlePause = () => {
    setIsPlaying(false);
    setIsBuffering(false);
    setShowControls(true);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setIsBuffering(false);
    setProgress(100);
    setShowControls(true);
  };

  const handleError = () => {
    setIsPlaying(false);
    setIsBuffering(false);

    setError(
      'Failed to load video stream. The file format might not be supported or the network was interrupted.'
    );
  };


  // =========================================================
  // PLAY
  // =========================================================
  const playVideo = async () => {
    const video = videoRef.current;

    if (!video) return;

    // Already playing
    if (!video.paused) {
      setIsPlaying(true);
      return;
    }

    // If another play request is still pending, wait for it.
    if (playRequestRef.current) {
      try {
        await playRequestRef.current;
      } catch {
        // Previous request may have been interrupted.
      }

      playRequestRef.current = null;
    }

    setError(null);

    let request = null;

    try {
      request = video.play();

      playRequestRef.current = request;

      await request;

      // This request is no longer the active request.
      if (playRequestRef.current !== request) {
        return;
      }

      // Video was paused while play() was resolving.
      if (video.paused) {
        return;
      }

      setIsPlaying(true);

      if (
        socket &&
        roomCode &&
        !applyingRemoteUpdate.current
      ) {
        socket.emit('playback:play', {
          roomCode,
          position: video.currentTime,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        console.log(
          '[MoviePlayer] Play request interrupted safely.'
        );
        return;
      }

      console.error(
        '[MoviePlayer] Play failed:',
        err
      );

      setIsPlaying(false);

      setError(
        'Unable to play this video. Please check the video URL or try again.'
      );
    } finally {
      if (playRequestRef.current === request) {
        playRequestRef.current = null;
      }
    }
  };// =========================================================
  // PAUSE
  // =========================================================
  const pauseVideo = () => {
    const video = videoRef.current;

    if (!video) return;

    const position = video.currentTime;

    console.log(
      '[MoviePlayer] Local PAUSE:',
      position
    );

    // Invalidate any pending play request.
    playRequestRef.current = null;

    if (!video.paused) {
      video.pause();
    }

    setIsPlaying(false);

    if (
      socket &&
      roomCode &&
      !applyingRemoteUpdate.current
    ) {
      socket.emit('playback:pause', {
        roomCode,
        position,
        reason: 'user',
        timestamp: Date.now(),
      });
    }
  };// =========================================================
  // TOGGLE PLAY / PAUSE
  // =========================================================

  const togglePlay = async () => {
    const video = videoRef.current;

    if (!video) return;

    if (video.paused) {
      await playVideo();
    } else {
      pauseVideo();
    }
  };

  // =========================================================
  // SKIP FORWARD / BACKWARD 10 SECONDS
  // =========================================================

  const skip = (seconds) => {
    const video = videoRef.current;

    if (!video) return;

    // Video duration must be available
    if (!Number.isFinite(video.duration)) {
      return;
    }

    const currentPosition = video.currentTime;

    // Calculate new position
    const newPosition = Math.max(
      0,
      Math.min(
        video.duration,
        currentPosition + seconds
      )
    );

    console.log(
      `[MoviePlayer] SKIP ${seconds > 0 ? '+' : ''}${seconds}s:`,
      currentPosition,
      '→',
      newPosition
    );

    // Move local video
    try {
      video.currentTime = newPosition;
    } catch (err) {
      console.warn(
        '[MoviePlayer] Skip failed:',
        err
      );
      return;
    }

    // Update local UI immediately
    updateTimeUI(newPosition);

    // Synchronize skip with the other person
    if (
      socket &&
      roomCode &&
      !applyingRemoteUpdate.current
    ) {
      socket.emit('playback:seek', {
        roomCode,
        position: newPosition,
        timestamp: Date.now(),
      });
    }
  };
  // =========================================================
  // VOLUME
  // =========================================================

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);

    setVolume(vol);

    const video = videoRef.current;

    if (!video) return;

    video.volume = vol;

    if (vol === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }

    /*
     * Volume is intentionally local.
     * We don't change the partner's volume.
     */
    if (socket && roomCode) {
      socket.emit('playback:volume', {
        roomCode,
        volume: vol,
      });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;

    if (!video) return;

    if (video.muted || isMuted) {
      video.muted = false;

      if (volume === 0) {
        video.volume = 0.5;
        setVolume(0.5);
      }

      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  // =========================================================
  // PROGRESS BAR
  // =========================================================

  const handleProgressClick = (e) => {
    const progressElement = progressRef.current;
    const video = videoRef.current;

    if (!progressElement || !video) return;

    if (!Number.isFinite(video.duration)) return;

    const rect =
      progressElement.getBoundingClientRect();

    const position = Math.max(
      0,
      Math.min(
        1,
        (e.clientX - rect.left) / rect.width
      )
    );

    const newTime =
      position * video.duration;

    video.currentTime = newTime;

    updateTimeUI(newTime);

    if (
      socket &&
      roomCode &&
      !applyingRemoteUpdate.current
    ) {
      socket.emit('playback:seek', {
        roomCode,
        position: newTime,
        timestamp: Date.now(),
      });
    }
  };

  // =========================================================
  // FULLSCREEN
  // =========================================================

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error(
        '[MoviePlayer] Fullscreen error:',
        err
      );
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(document.fullscreenElement)
      );
    };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, []);

  // =========================================================
  // KEYBOARD CONTROLS
  // =========================================================

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!containerRef.current) return;

      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA'].includes(
          document.activeElement.tagName
        )
      ) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;

        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;

        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;

        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [isMuted, volume, isPlaying]);

  // =========================================================
  // RESET WHEN URL CHANGES
  // =========================================================

  useEffect(() => {
    const video = videoRef.current;

    // Invalidate any old play request.
    playRequestRef.current = null;

    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsBuffering(true);

    if (!video) return;

    video.pause();

    try {
      video.currentTime = 0;
    } catch (err) {
      console.warn(
        '[MoviePlayer] Video reset failed:',
        err
      );
    }
  }, [url]);
  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }}
      onClick={(e) => {
        if (
          e.target === containerRef.current ||
          e.target === videoRef.current
        ) {
          togglePlay();
        }
      }}
    >
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30 bg-black">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />

          <p className="text-red-400 text-sm max-w-sm">
            {error}
          </p>

          <button
            onClick={() => {
              setError(null);

              if (videoRef.current) {
                videoRef.current.load();
              }
            }}
            className="mt-5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>

          {/* VIDEO URL DEBUG */}
          <div className="absolute top-2 left-2 z-50 bg-black/80 text-white text-xs p-2 rounded">
            VIDEO URL: {url || 'NO URL'}
          </div>
          {/* VIDEO */}
          <video
            ref={videoRef}
            src={url}
            className="w-full h-full max-h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={handleLoadedData}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleError}
            playsInline
            preload="metadata"
          />

          {/* BUFFERING */}

          {isBuffering && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            </div>
          )}

          {/* CONTROLS */}

          <div
            className={`absolute inset-0 pointer-events-none flex flex-col justify-between transition-opacity duration-300 z-20 ${showControls
              ? 'opacity-100'
              : 'opacity-0'
              }`}
          >
            {/* TOP */}

            <div className="w-full pt-4 pb-12 px-6 bg-gradient-to-b from-black/80 to-transparent">
              <h2 className="text-white/90 font-medium truncate max-w-lg shadow-black drop-shadow-md">
                {title || 'Shared Movie Date'}
              </h2>
            </div>

            {/* BOTTOM */}

            <div className="w-full pt-16 pb-4 px-4 sm:px-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-auto">
              {/* PROGRESS */}

              <div
                ref={progressRef}
                className="w-full h-1.5 sm:h-2 bg-white/20 rounded-full mb-4 cursor-pointer group/progress relative"
                onClick={handleProgressClick}
              >
                <div className="absolute inset-y-[-10px] inset-x-0" />

                <div
                  className="h-full bg-primary-500 rounded-full relative"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, progress)
                    )}%`,
                  }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform shadow-lg" />
                </div>
              </div>

              {/* ACTION BUTTONS */}

              <div className="flex items-center justify-between">
                {/* LEFT */}

                <div className="flex items-center gap-3 sm:gap-6">
                  {/* PLAY / PAUSE */}

                  <button
                    onClick={togglePlay}
                    className="text-white hover:text-primary-400 transition-colors"
                    title={
                      isPlaying
                        ? 'Pause'
                        : 'Play'
                    }
                    type="button"
                  >
                    {isPlaying ? (
                      <Pause
                        className="w-6 h-6 sm:w-7 sm:h-7"
                        fill="currentColor"
                      />
                    ) : (
                      <Play
                        className="w-6 h-6 sm:w-7 sm:h-7"
                        fill="currentColor"
                      />
                    )}
                  </button>

                  {/* SKIP */}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => skip(-10)}
                      className="text-white/80 hover:text-white transition-colors"
                      title="Rewind 10 seconds"
                      type="button"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => skip(10)}
                      className="text-white/80 hover:text-white transition-colors"
                      title="Skip 10 seconds"
                      type="button"
                    >
                      <RotateCw className="w-5 h-5" />
                    </button>
                  </div>

                  {/* VOLUME */}

                  <div className="hidden sm:flex items-center gap-2 group/volume relative">
                    <button
                      onClick={toggleMute}
                      className="text-white/80 hover:text-white transition-colors"
                      title={
                        isMuted
                          ? 'Unmute'
                          : 'Mute'
                      }
                      type="button"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={
                        isMuted
                          ? 0
                          : volume
                      }
                      onChange={
                        handleVolumeChange
                      }
                      className="w-0 overflow-hidden group-hover/volume:w-20 opacity-0 group-hover/volume:opacity-100 transition-all duration-300 accent-primary-500 h-1 bg-white/20 rounded-full appearance-none outline-none"
                      aria-label="Volume"
                    />
                  </div>

                  {/* TIME */}

                  <div className="text-xs sm:text-sm font-medium text-white/90 font-mono tracking-wider ml-2">
                    {formatTime(currentTime)} /{' '}
                    {formatTime(duration)}
                  </div>
                </div>

                {/* RIGHT */}

                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleFullscreen}
                    className="text-white/80 hover:text-white transition-colors"
                    title={
                      isFullscreen
                        ? 'Exit fullscreen'
                        : 'Fullscreen'
                    }
                    type="button"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-5 h-5" />
                    ) : (
                      <Maximize className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MoviePlayer;