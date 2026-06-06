import { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';

const CallOverlay = () => {
  const { callState, callNotice, localStream, remoteStream, endCall, toggleMute, toggleVideo } =
    useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isOverlayVisible = callState.status === 'connected' || callState.status === 'calling';

  if (!isOverlayVisible && !callNotice) return null;

  return (
    <>
      {callNotice && (
        <div className="fixed left-1/2 top-5 z-[120] -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface shadow-[0_14px_36px_rgba(40,37,32,0.18)]">
          {callNotice}
        </div>
      )}

      {isOverlayVisible && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#111111]">
          <div className="absolute inset-0 h-full w-full">
            {callState.type === 'video' && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[#111111]">
                <img
                  src={callState.partner?.avatar || 'https://via.placeholder.com/150'}
                  alt="Partner Avatar"
                  className="mb-6 h-40 w-40 rounded-xl border border-white/15 object-cover"
                />
                <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white">
                  {callState.partner?.name || 'Người gọi'}
                </h2>
                <p className="mt-2 text-white/60">
                  {callState.status === 'calling' ? 'Đang gọi...' : 'Đang kết nối...'}
                </p>
              </div>
            )}
          </div>

          {callState.type === 'video' && (
            <div className="absolute bottom-28 right-8 z-10 h-60 w-40 overflow-hidden rounded-xl border border-white/20 bg-[#111111]">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
            <button
              type="button"
              onClick={toggleMute}
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                callState.isMuted ? 'bg-error text-white' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
              title={callState.isMuted ? 'Bật micro' : 'Tắt micro'}
            >
              <span className="material-symbols-outlined">
                {callState.isMuted ? 'mic_off' : 'mic'}
              </span>
            </button>

            {callState.type === 'video' && (
              <button
                type="button"
                onClick={toggleVideo}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                  callState.isVideoOff
                    ? 'bg-error text-white'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={callState.isVideoOff ? 'Bật camera' : 'Tắt camera'}
              >
                <span className="material-symbols-outlined">
                  {callState.isVideoOff ? 'videocam_off' : 'videocam'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={endCall}
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-error text-white transition-colors hover:bg-error/90"
              title="Kết thúc"
            >
              <span className="material-symbols-outlined text-2xl">call_end</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CallOverlay;
