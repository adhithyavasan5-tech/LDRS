import { useEffect, useRef, useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
} from 'lucide-react';

const VideoCall = ({ socket, roomCode }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const mediaPromiseRef = useRef(null);
  const iceCandidateQueue = useRef([]);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState(null);

  // ---------------------------------------------------------
  // WebRTC configuration
  // ---------------------------------------------------------

  const rtcConfig = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
      {
        urls: 'stun:stun1.l.google.com:19302',
      },
    ],
  };

  // ---------------------------------------------------------
  // Create Peer Connection
  // ---------------------------------------------------------

  const createPeerConnection = () => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const pc = new RTCPeerConnection(rtcConfig);

    peerConnectionRef.current = pc;

    // Receive partner's video/audio
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received');

      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];

        remoteVideoRef.current
          .play()
          .catch((err) => {
            console.warn('[WebRTC] Remote video autoplay:', err);
          });
      }
    };

    // Send ICE candidates through Socket.io
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      console.log('[WebRTC] Sending ICE candidate');

      socket?.emit('call:ice-candidate', {
        roomCode,
        candidate: event.candidate,
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(
        '[WebRTC] Connection state:',
        pc.connectionState
      );

      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'closed'
      ) {
        console.warn('[WebRTC] Connection lost');
      }
    };

    return pc;
  };

  // ---------------------------------------------------------
  // Start Camera
  // ---------------------------------------------------------

  const startCamera = async () => {
    try {
      setError(null);

      if (localStreamRef.current) {
        return localStreamRef.current;
      }

      if (mediaPromiseRef.current) {
        return await mediaPromiseRef.current;
      }

      mediaPromiseRef.current = navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const stream = await mediaPromiseRef.current;

      localStreamRef.current = stream;
      mediaPromiseRef.current = null;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCameraOn(true);
      setMicOn(true);
      setCallActive(true);

      console.log('[VideoCall] Camera started');

      return stream;
    } catch (err) {
      console.error('[VideoCall] Camera error:', err);
      mediaPromiseRef.current = null;

      let msg = 'Camera or microphone permission was denied.';
      if (err.name === 'NotReadableError' || err?.message?.includes('Device in use')) {
        msg = 'Camera is currently being used by another application.\n\nClose apps such as:\n• Camera\n• Zoom\n• Google Meet\n• Microsoft Teams\n• OBS\n\nThen click Retry.';
      } else if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        msg = 'Camera access denied. Please allow camera permissions in your browser.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera or microphone found on this device.';
      }

      setError(msg);

      return null;
    }
  };

  // ---------------------------------------------------------
  // Add Local Tracks to Peer Connection
  // ---------------------------------------------------------

  const addLocalTracks = async (pc) => {
    const stream = localStreamRef.current;

    if (!stream) return;

    const existingSenders = pc
      .getSenders()
      .map((sender) => sender.track);

    stream.getTracks().forEach((track) => {
      if (!existingSenders.includes(track)) {
        pc.addTrack(track, stream);
      }
    });
  };

  // ---------------------------------------------------------
  // Create Offer
  // ---------------------------------------------------------

  const createOffer = async () => {
    try {
      console.log('[WebRTC] Creating offer');

      const pc = createPeerConnection();

      await addLocalTracks(pc);

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      socket?.emit('call:offer', {
        roomCode,
        offer,
      });

      console.log('[WebRTC] Offer sent');
    } catch (err) {
      console.error('[WebRTC] Offer error:', err);
    }
  };

  // ---------------------------------------------------------
  // Handle Offer
  // ---------------------------------------------------------

  const handleOffer = async (data) => {
    try {
      console.log('[WebRTC] Offer received');

      const stream = await startCamera();

      if (!stream) return;

      const pc = createPeerConnection();

      await addLocalTracks(pc);

      await pc.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );

      // Process any ICE candidates that arrived before the remote description was set
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[WebRTC] Queued ICE candidate added');
        } catch (e) {
          console.warn('[WebRTC] Error adding queued ICE candidate', e);
        }
      }

      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);

      socket?.emit('call:answer', {
        roomCode,
        answer,
      });

      console.log('[WebRTC] Answer sent');
    } catch (err) {
      console.error('[WebRTC] Handle offer error:', err);
    }
  };

  // ---------------------------------------------------------
  // Handle Answer
  // ---------------------------------------------------------

  const handleAnswer = async (data) => {
    try {
      console.log('[WebRTC] Answer received');

      const pc = peerConnectionRef.current;

      if (!pc) {
        console.warn(
          '[WebRTC] No peer connection for answer'
        );
        return;
      }

      await pc.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );

      console.log('[WebRTC] Remote description set');

      // Process any ICE candidates that arrived before the remote description was set
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[WebRTC] Queued ICE candidate added');
        } catch (e) {
          console.warn('[WebRTC] Error adding queued ICE candidate', e);
        }
      }
    } catch (err) {
      console.error('[WebRTC] Handle answer error:', err);
    }
  };

  // ---------------------------------------------------------
  // Handle ICE Candidate
  // ---------------------------------------------------------

  const handleIceCandidate = async (data) => {
    try {
      if (!data.candidate) return;

      const pc = peerConnectionRef.current;

      if (!pc || !pc.remoteDescription) {
        console.log('[WebRTC] Queuing ICE candidate (pc not ready)');
        iceCandidateQueue.current.push(data.candidate);
        return;
      }

      await pc.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );

      console.log('[WebRTC] ICE candidate added');
    } catch (err) {
      console.error(
        '[WebRTC] ICE candidate error:',
        err
      );
    }
  };

  // ---------------------------------------------------------
  // Handle Local Video Stream Attachment
  // ---------------------------------------------------------

  useEffect(() => {
    if (callActive && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch((e) => console.warn('[VideoCall] Auto-play error:', e));
    }
  }, [callActive]);

  // ---------------------------------------------------------
  // Socket + WebRTC Events
  // ---------------------------------------------------------

  useEffect(() => {
    if (!socket || !roomCode) return;

    console.log(
      '[VideoCall] Setting up WebRTC listeners'
    );

    // Existing person receives this when partner joins
    const handlePartnerJoined = async () => {
      console.log(
        '[VideoCall] Partner joined - creating offer'
      );

      const stream = await startCamera();

      if (!stream) return;

      await createOffer();
    };

    socket.on(
      'room:partner_joined',
      handlePartnerJoined
    );

    socket.on(
      'call:offer',
      handleOffer
    );

    socket.on(
      'call:answer',
      handleAnswer
    );

    socket.on(
      'call:ice-candidate',
      handleIceCandidate
    );

    return () => {
      socket.off(
        'room:partner_joined',
        handlePartnerJoined
      );

      socket.off(
        'call:offer',
        handleOffer
      );

      socket.off(
        'call:answer',
        handleAnswer
      );

      socket.off(
        'call:ice-candidate',
        handleIceCandidate
      );
    };
  }, [socket, roomCode]);

  // ---------------------------------------------------------
  // Stop Camera / Call
  // ---------------------------------------------------------

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      localStreamRef.current = null;
    }

    mediaPromiseRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setCameraOn(false);
    setCallActive(false);

    console.log('[VideoCall] Call stopped');
  };

  // ---------------------------------------------------------
  // Toggle Camera
  // ---------------------------------------------------------

  const toggleCamera = async () => {
    if (!localStreamRef.current) {
      await startCamera();
      return;
    }

    const videoTrack =
      localStreamRef.current.getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;

    setCameraOn(videoTrack.enabled);
  };

  // ---------------------------------------------------------
  // Toggle Microphone
  // ---------------------------------------------------------

  const toggleMic = () => {
    if (!localStreamRef.current) return;

    const audioTrack =
      localStreamRef.current.getAudioTracks()[0];

    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;

    setMicOn(audioTrack.enabled);
  };

  // ---------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      mediaPromiseRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">

      {/* REMOTE VIDEO */}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover bg-black"
      />

      {/* WAITING */}

      {!callActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-300">

          <Video className="w-10 h-10 text-primary-500/60 mb-3" />

          <p className="text-sm text-gray-300">
            Video Call
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Start your camera to begin
          </p>

          {error && (
            <div className="mt-3 px-6 text-center">
              <p className="text-xs text-red-400 whitespace-pre-line">
                {error}
              </p>
            </div>
          )}

          <button
            onClick={startCamera}
            className="mt-5 px-5 py-2.5 rounded-full bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium transition"
          >
            {error ? 'Retry Camera' : 'Start Camera'}
          </button>

        </div>
      )}

      {/* LOCAL VIDEO */}

      {callActive && (
        <div className="absolute top-3 right-3 w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden border border-white/20 bg-black shadow-xl">

          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {!cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-dark-400">
              <VideoOff className="w-5 h-5 text-gray-400" />
            </div>
          )}

        </div>
      )}

      {/* CONTROLS */}

      {callActive && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3">

          {/* MICROPHONE */}

          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              micOn
                ? 'bg-white/15 hover:bg-white/25'
                : 'bg-red-500 hover:bg-red-600'
            }`}
            title={
              micOn
                ? 'Mute microphone'
                : 'Unmute microphone'
            }
          >
            {micOn ? (
              <Mic className="w-5 h-5 text-white" />
            ) : (
              <MicOff className="w-5 h-5 text-white" />
            )}
          </button>

          {/* CAMERA */}

          <button
            onClick={toggleCamera}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              cameraOn
                ? 'bg-white/15 hover:bg-white/25'
                : 'bg-red-500 hover:bg-red-600'
            }`}
            title={
              cameraOn
                ? 'Turn camera off'
                : 'Turn camera on'
            }
          >
            {cameraOn ? (
              <Video className="w-5 h-5 text-white" />
            ) : (
              <VideoOff className="w-5 h-5 text-white" />
            )}
          </button>

          {/* END CALL */}

          <button
            onClick={stopCamera}
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition"
            title="End call"
          >
            <PhoneOff className="w-5 h-5 text-white" />
          </button>

        </div>
      )}

    </div>
  );
};

export default VideoCall;