import { io } from 'socket.io-client';

let socket = null;

/**
 * Initialize and connect the Socket.io socket
 * @param {string} token - JWT for authentication
 * @returns {Socket}
 */
export const initSocket = (token) => {
  if (socket?.connected) return socket;
  const socketUrl =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
    window.location.origin;
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
};

/**
 * Get the current socket instance
 */
export const getSocket = () => socket;

/**
 * Disconnect and clean up
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
