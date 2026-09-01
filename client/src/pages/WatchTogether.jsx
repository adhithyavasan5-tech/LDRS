import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Heart,
  Send,
} from 'lucide-react';

import { roomService } from '../services/roomService';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

import { PageLoader } from '../components/ui/Loader';
import { ConnectionBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import MoviePlayer from '../components/player/MoviePlayer';
import VideoCall from '../components/call/VideoCall';

const WatchTogether = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // =========================================================
  // ROOM STATE
  // =========================================================

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partnerConnected, setPartnerConnected] = useState(false);

  // =========================================================
  // CHAT STATE
  // =========================================================

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // =========================================================
  // FULLSCREEN STATE
  // =========================================================

  const fullscreenContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // =========================================================
  // AUTO SCROLL CHAT
  // =========================================================

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  // =========================================================
  // FULLSCREEN CHANGE
  // =========================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement ===
        fullscreenContainerRef.current
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
  // LOAD ROOM + JOIN SOCKET ROOM
  // =========================================================

  useEffect(() => {
    if (!roomCode) {
      setError('Room code is missing.');
      setLoading(false);
      return;
    }

    if (!isConnected || !socket) {
      return;
    }

    let mounted = true;

    const initRoom = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(
          '[WatchTogether] Loading room:',
          roomCode
        );

        // -----------------------------------------------------
        // GET ROOM FROM BACKEND
        // -----------------------------------------------------

        const res =
          await roomService.getRoomByCode(roomCode);

        console.log(
          '[WatchTogether] Room response:',
          res
        );

        if (!res?.success) {
          throw new Error(
            res?.message || 'Room not found'
          );
        }

        if (!mounted) return;

        const roomData = res.room;

        console.log(
          '[WatchTogether] Room data:',
          roomData
        );

        console.log(
          '[WatchTogether] Movie URL:',
          roomData?.movieUrl
        );

        // -----------------------------------------------------
        // CHECK MOVIE URL
        // -----------------------------------------------------

        if (!roomData?.movieUrl) {
          console.warn(
            '[WatchTogether] WARNING: movieUrl is missing from room'
          );
        }

        setRoom(roomData);

        // -----------------------------------------------------
        // JOIN SOCKET ROOM
        // -----------------------------------------------------

        socket.emit(
          'room:join',
          { roomCode },
          (response) => {
            if (!mounted) return;

            console.log(
              '[WatchTogether] room:join response:',
              response
            );

            if (response?.error) {
              setError(response.error);
              return;
            }

            const participantCount = Number(
              response?.participantCount || 0
            );

            setPartnerConnected(
              participantCount >= 2
            );
          }
        );
      } catch (err) {
        console.error(
          '[WatchTogether] Failed to load room:',
          err
        );

        if (mounted) {
          setError(
            err?.response?.data?.message ||
            err?.message ||
            'Error loading room'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initRoom();

    return () => {
      mounted = false;
    };
  }, [roomCode, socket, isConnected]);

  // =========================================================
  // PARTNER JOIN / LEAVE
  // =========================================================

  useEffect(() => {
    if (!socket) return;

    const handlePartnerJoined = (data) => {
      console.log(
        '[Room] Partner joined:',
        data
      );

      setPartnerConnected(true);
    };

    const handlePartnerLeft = (data) => {
      console.log(
        '[Room] Partner left:',
        data
      );

      setPartnerConnected(false);
      setIsPartnerTyping(false);
    };

    socket.on(
      'room:partner_joined',
      handlePartnerJoined
    );

    socket.on(
      'room:partner_left',
      handlePartnerLeft
    );

    return () => {
      socket.off(
        'room:partner_joined',
        handlePartnerJoined
      );

      socket.off(
        'room:partner_left',
        handlePartnerLeft
      );
    };
  }, [socket]);

  // =========================================================
  // CHAT: RECEIVE MESSAGE
  // =========================================================

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (message) => {
      console.log(
        '[Chat] RECEIVED:',
        message
      );

      if (!message) return;

      setMessages((prev) => {
        // Prevent duplicate messages
        if (
          message._id &&
          prev.some(
            (item) =>
              item._id === message._id
          )
        ) {
          return prev;
        }

        return [...prev, message];
      });
    };

    socket.on(
      'chat:message',
      handleChatMessage
    );

    return () => {
      socket.off(
        'chat:message',
        handleChatMessage
      );
    };
  }, [socket]);

  // =========================================================
  // CHAT: PARTNER TYPING
  // =========================================================

  useEffect(() => {
    if (!socket) return;

    const handlePartnerTyping = (data) => {
      console.log(
        '[Chat] Partner typing:',
        data
      );

      setIsPartnerTyping(
        Boolean(data?.isTyping)
      );
    };

    socket.on(
      'chat:typing',
      handlePartnerTyping
    );

    return () => {
      socket.off(
        'chat:typing',
        handlePartnerTyping
      );
    };
  }, [socket]);

  // =========================================================
  // SEND CHAT MESSAGE
  // =========================================================

  const sendMessage = () => {
    const text = messageText.trim();

    if (!text) return;

    if (!socket || !isConnected) {
      console.warn(
        '[Chat] Socket is not connected'
      );
      return;
    }

    if (!roomCode) {
      console.warn(
        '[Chat] Room code missing'
      );
      return;
    }

    const payload = {
      roomCode,
      message: text,
      imageUrl: null,
      messageType: 'text',
    };

    console.log(
      '[Chat] SENDING:',
      payload
    );

    socket.emit(
      'chat:message',
      payload
    );

    setMessageText('');

    socket.emit(
      'chat:typing',
      {
        roomCode,
        isTyping: false,
      }
    );

    setIsPartnerTyping(false);
  };

  // =========================================================
  // CHAT INPUT
  // =========================================================

  const handleChatInput = (e) => {
    const value = e.target.value;

    setMessageText(value);

    if (!socket || !isConnected || !roomCode) {
      return;
    }

    socket.emit(
      'chat:typing',
      {
        roomCode,
        isTyping: value.length > 0,
      }
    );

    if (typingTimeoutRef.current) {
      clearTimeout(
        typingTimeoutRef.current
      );
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit(
        'chat:typing',
        {
          roomCode,
          isTyping: false,
        }
      );
    }, 1500);
  };

  // =========================================================
  // ENTER KEY
  // =========================================================

  const handleChatKeyDown = (e) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey
    ) {
      e.preventDefault();
      sendMessage();
    }
  };

  // =========================================================
  // CLEANUP TYPING TIMER
  // =========================================================

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }
    };
  }, []);

  // =========================================================
  // LEAVE ROOM
  // =========================================================

  useEffect(() => {
    return () => {
      if (socket && roomCode) {
        console.log(
          '[Room] Leaving room:',
          roomCode
        );

        socket.emit(
          'room:leave',
          { roomCode }
        );
      }
    };
  }, [socket, roomCode]);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <PageLoader
        message="Connecting to room..."
      />
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">

        <Heart className="w-12 h-12 text-red-500 mb-4 opacity-70" />

        <h2 className="text-xl font-semibold mb-2">
          Unable to join room
        </h2>

        <p className="text-gray-400 mb-6 max-w-md">
          {error}
        </p>

        <Button
          onClick={() =>
            navigate('/home')
          }
        >
          Back to Home
        </Button>

      </div>
    );
  }

  // =========================================================
  // MOVIE URL
  // =========================================================

  const movieUrl =
    room?.movieUrl ||
    room?.movieURL ||
    room?.videoUrl ||
    room?.videoURL ||
    '';

  const movieTitle =
    room?.movieName ||
    room?.movieTitle ||
    room?.roomName ||
    'Shared Movie Date';

  const currentRoomCode =
    room?.roomCode ||
    roomCode;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">

      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <header className="flex-none h-14 bg-dark-400/90 border-b border-white/10 flex items-center justify-between px-4 z-20">

        <div className="flex items-center gap-4">

          <button
            onClick={() =>
              navigate('/home')
            }
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>

            <h1 className="font-medium text-sm">
              {room?.roomName ||
                'Watch Together'}
            </h1>

            <div className="flex items-center gap-2">

              <span className="text-xs text-gray-400">
                Code:{' '}
                {currentRoomCode}
              </span>

              <span className="text-gray-600 text-xs">
                •
              </span>

              <ConnectionBadge
                status={
                  partnerConnected
                    ? 'connected'
                    : 'buffering'
                }
              />

            </div>

          </div>

        </div>

        <div className="text-xs text-gray-500">

          {partnerConnected
            ? 'Partner connected'
            : 'Waiting for partner...'}

        </div>

      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ===================================================
            MOVIE PLAYER
        =================================================== */}

        <div
          ref={fullscreenContainerRef}
          className={`flex-[3] min-w-0 relative bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10 ${isFullscreen
              ? 'fixed inset-0 z-[9999] w-screen h-screen'
              : ''
            }`}
        >

          {room ? (

            movieUrl ? (

              <MoviePlayer
                url={movieUrl}
                title={movieTitle}
                roomCode={currentRoomCode}
                socket={socket}
                initialPosition={
                  Number(
                    room?.playbackPosition || 0
                  )
                }
                initialIsPlaying={
                  Boolean(
                    room?.isPlaying || false
                  )
                }
              />

            ) : (

              <div className="flex flex-col items-center justify-center text-center p-6">

                <Heart className="w-10 h-10 text-red-500 mb-4 opacity-60" />

                <h2 className="text-lg font-semibold mb-2">
                  Movie not available
                </h2>

                <p className="text-sm text-gray-500 max-w-md">
                  This room does not contain a valid movie URL.
                </p>

                <p className="text-xs text-gray-600 mt-3 break-all max-w-lg">
                  Room: {currentRoomCode}
                </p>

              </div>

            )

          ) : (

            <div className="text-gray-400">
              Loading movie...
            </div>

          )}

        </div>

        {/* ===================================================
            RIGHT PANEL
        =================================================== */}

        {!isFullscreen && (

          <div className="flex-[1] min-w-[320px] max-w-[400px] flex flex-col bg-dark-200">

            {/* =================================================
                VIDEO CALL
            ================================================= */}

            <div className="flex-none h-48 md:h-64 border-b border-white/10 bg-black relative overflow-hidden">

              <VideoCall
                socket={socket}
                roomCode={currentRoomCode}
              />

            </div>

            {/* =================================================
                CHAT
            ================================================= */}

            <div className="flex-1 flex flex-col min-h-0 bg-dark-200">

              {/* CHAT HEADER */}

              <div className="flex-none px-4 py-3 border-b border-white/10 flex items-center gap-2">

                <MessageCircle className="w-5 h-5 text-primary-400" />

                <div className="flex-1">

                  <h2 className="text-sm font-semibold">
                    Chat
                  </h2>

                  <p className="text-[10px] text-gray-500">

                    {isPartnerTyping
                      ? 'Partner is typing...'
                      : partnerConnected
                        ? 'Chat with your partner'
                        : 'Waiting for partner...'}

                  </p>

                </div>

                <div
                  className={`w-2 h-2 rounded-full ${partnerConnected
                      ? 'bg-green-500'
                      : 'bg-gray-600'
                    }`}
                />

              </div>

              {/* =================================================
                  MESSAGE LIST
              ================================================= */}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {messages.length === 0 ? (

                  <div className="h-full flex flex-col items-center justify-center text-center">

                    <MessageCircle className="w-8 h-8 text-gray-600 mb-3" />

                    <p className="text-sm text-gray-500">
                      No messages yet
                    </p>

                    <p className="text-xs text-gray-600 mt-1">
                      Start the conversation ❤️
                    </p>

                  </div>

                ) : (

                  messages.map(
                    (message, index) => {

                      const myId =
                        user?._id ||
                        user?.id;

                      const senderId =
                        message?.senderId ||
                        message?.userId;

                      const isMine =
                        senderId &&
                        myId &&
                        String(senderId) ===
                        String(myId);

                      return (
                        <div
                          key={
                            message?._id ||
                            `${message?.timestamp || Date.now()}-${index}`
                          }
                          className={`flex ${isMine
                              ? 'justify-end'
                              : 'justify-start'
                            }`}
                        >

                          <div
                            className={`max-w-[80%] flex flex-col ${isMine
                                ? 'items-end'
                                : 'items-start'
                              }`}
                          >

                            {!isMine && (
                              <span className="text-[10px] text-gray-500 mb-1 px-2">
                                {message?.senderName ||
                                  'Partner'}
                              </span>
                            )}

                            <div
                              className={`px-3 py-2 rounded-2xl text-sm break-words ${isMine
                                  ? 'bg-primary-500 text-white rounded-br-md'
                                  : 'bg-white/10 text-gray-200 rounded-bl-md'
                                }`}
                            >
                              {message?.message ||
                                message?.text ||
                                ''}
                            </div>

                            <span className="text-[9px] text-gray-600 mt-1 px-2">

                              {message?.timestamp
                                ? new Date(
                                  message.timestamp
                                ).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )
                                : ''}

                            </span>

                          </div>

                        </div>
                      );
                    }
                  )

                )}

                <div ref={chatEndRef} />

              </div>

              {/* =================================================
                  CHAT INPUT
              ================================================= */}

              <div className="flex-none p-3 border-t border-white/10 bg-dark-300">

                <div className="flex items-center gap-2 bg-dark-400 rounded-2xl px-3 py-2 border border-white/10">

                  <input
                    type="text"
                    value={messageText}
                    onChange={handleChatInput}
                    onKeyDown={handleChatKeyDown}
                    placeholder={
                      partnerConnected
                        ? 'Type a message...'
                        : 'Waiting for partner...'
                    }
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
                  />

                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={
                      !messageText.trim() ||
                      !socket ||
                      !isConnected
                    }
                    className="flex-none w-9 h-9 rounded-full bg-primary-500 hover:bg-primary-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>

                </div>

                <p className="text-[9px] text-gray-600 mt-2 text-center">
                  Press Enter to send
                </p>

              </div>

            </div>

          </div>

        )}

      </div>

    </div>
  );
};

export default WatchTogether;