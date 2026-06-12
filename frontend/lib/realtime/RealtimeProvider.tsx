import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useRealtimeStore } from './useRealtimeStore';

/** Connect WebSocket when user is authenticated; disconnect on logout. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const connect = useRealtimeStore((s) => s.connect);
  const disconnect = useRealtimeStore((s) => s.disconnect);

  useEffect(() => {
    if (!userId) {
      disconnect();
      return;
    }
    connect();
    return () => disconnect();
  }, [userId, connect, disconnect]);

  return <>{children}</>;
}

export default RealtimeProvider;
