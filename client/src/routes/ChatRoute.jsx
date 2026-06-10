import Chat from '../pages/Chat';
import { SocketProvider } from '../context/SocketContext';
import { CallProvider } from '../context/CallContext';

const ChatRoute = () => (
  <SocketProvider>
    <CallProvider>
      <Chat />
    </CallProvider>
  </SocketProvider>
);

export default ChatRoute;
