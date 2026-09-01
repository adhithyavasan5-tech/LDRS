import { useEffect, useRef, useState } from 'react';
import { initSocket, disconnectSocket, getSocket } from '../services/socketService';
import { useAuth } from './useAuth';

/**
 * Hook to manage Socket.io connection lifecycle
 * Connects on mount, disconnects on unmount
 */
export const useSocket = () => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const socket = initSocket(token);
    socketRef.current = socket;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [token]);

  return {
    socket: socketRef.current || getSocket(),
    isConnected,
  };
};
