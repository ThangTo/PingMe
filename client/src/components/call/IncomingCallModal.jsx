import { useCall } from '../../context/CallContext';

const IncomingCallModal = () => {
  const { callState, acceptCall, rejectCall } = useCall();

  if (callState.status !== 'ringing') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/35 backdrop-blur-sm">
      <div className="flex w-80 flex-col items-center gap-6 rounded-xl border border-outline-variant bg-surface p-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-xl border border-primary opacity-20"></div>
          <img
            src={callState.partner?.avatar || 'https://via.placeholder.com/150'}
            alt="Avatar"
            className="relative z-10 h-full w-full rounded-xl border border-outline-variant object-cover"
          />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-on-surface">{callState.partner?.name || 'Ai đó'}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {callState.type === 'video' ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}
          </p>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={rejectCall}
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-error/20 bg-error-container text-error transition-colors hover:bg-error hover:text-white"
          >
            <span className="material-symbols-outlined text-3xl">call_end</span>
          </button>
          <button
            onClick={acceptCall}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-dark"
          >
            <span className="material-symbols-outlined text-3xl">call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
