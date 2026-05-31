import { useCall } from '../../context/CallContext';

const IncomingCallModal = () => {
  const { callState, acceptCall, rejectCall } = useCall();

  if (callState.status !== 'ringing') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 border border-white/10 w-80">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-50"></div>
          <img
            src={callState.partner?.avatar || 'https://via.placeholder.com/150'}
            alt="Avatar"
            className="w-full h-full rounded-full object-cover border-4 border-surface relative z-10"
          />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-on-surface">{callState.partner?.name || 'Ai đó'}</h2>
          <p className="text-secondary mt-1">
            {callState.type === 'video' ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}
          </p>
        </div>

        <div className="flex gap-8 mt-4">
          <button
            onClick={rejectCall}
            className="w-14 h-14 rounded-full bg-error hover:bg-error/80 flex items-center justify-center text-white transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">call_end</span>
          </button>
          <button
            onClick={acceptCall}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors animate-bounce"
          >
            <span className="material-symbols-outlined text-3xl">call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
