import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import AppIcon from '../ui/AppIcon';

const AVATAR_FALLBACK =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80';

const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'PM';

const PIP_EDGE_GAP = 16;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getClampedPipPosition = (x, y, width, height) => {
  if (typeof window === 'undefined') return { x, y };

  const maxX = Math.max(PIP_EDGE_GAP, window.innerWidth - width - PIP_EDGE_GAP);
  const maxY = Math.max(PIP_EDGE_GAP, window.innerHeight - height - PIP_EDGE_GAP);

  return {
    x: clamp(x, PIP_EDGE_GAP, maxX),
    y: clamp(y, PIP_EDGE_GAP, maxY),
  };
};

function SignalBars({ dark = false }) {
  const barClass = dark ? 'bg-white' : 'bg-[#4f4338]';

  return (
    <div className="flex h-5 items-end gap-0.5" aria-hidden="true">
      {[7, 11, 15].map((height) => (
        <span key={height} className={`${barClass} w-1 rounded-full`} style={{ height }} />
      ))}
    </div>
  );
}

function AudioWaveform() {
  const bars = [28, 48, 34, 62, 44, 74, 52, 36, 58, 40, 30];

  return (
    <div className="flex h-full items-center justify-center gap-1.5 opacity-70 sm:gap-2">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="w-2 rounded-full bg-[#c6a17c]/35"
          style={{ height }}
        />
      ))}
    </div>
  );
}

function ControlButton({
  label,
  icon,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  dark = false,
}) {
  const baseTone = dark
    ? 'bg-white/20 text-white hover:bg-white/30'
    : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high';
  const activeTone = dark
    ? 'bg-white text-black'
    : 'bg-on-surface text-surface';
  const dangerTone = 'bg-error text-surface hover:bg-error/90';
  const disabledTone = dark
    ? 'cursor-not-allowed bg-white/10 text-white/30'
    : 'cursor-not-allowed bg-surface-container-low opacity-50 text-on-surface-variant';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-[66px] min-w-[66px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[16px] px-2 text-[11px] font-medium transition-colors sm:h-[68px] sm:min-w-[88px] sm:rounded-[18px] sm:px-3 sm:text-[12px] ${
        disabled ? disabledTone : danger ? dangerTone : active ? activeTone : baseTone
      }`}
    >
      <AppIcon name={icon} className="text-[24px]" />
      <span className="max-w-[76px] truncate">{label}</span>
    </button>
  );
}

function ParticipantPill({ name, avatar, label, dark = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
        dark
          ? 'border-white/10 bg-white/[0.08] text-white'
          : 'border-[#eadfd2] bg-white/70 text-[#2d2823]'
      }`}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dbc9b8] text-sm font-semibold text-[#5d4a38]">
          {getInitials(name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className={`text-xs ${dark ? 'text-white/55' : 'text-[#817266]'}`}>{label}</p>
      </div>
    </div>
  );
}

function DetailRail({ partner, user, isVideoCall, dark = false }) {
  const panelTone = dark
    ? 'border-white/10 bg-[#151515] text-white'
    : 'border-[#eadfd2] bg-[#fbf8f1] text-[#2d2823]';
  const mutedText = dark ? 'text-white/58' : 'text-[#817266]';
  const statTone = dark ? 'border-white/10 bg-white/[0.08]' : 'border-[#eadfd2] bg-white/70';

  return (
    <aside
      className={`hidden w-[310px] shrink-0 flex-col gap-4 rounded-[28px] border p-4 xl:flex ${panelTone}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          Trong cuộc gọi
        </p>
        <div className="mt-3 space-y-2">
          <ParticipantPill
            name={partner.name}
            avatar={partner.avatar}
            label={isVideoCall ? 'Video đang hoạt động' : 'Đang nghe'}
            dark={dark}
          />
          <ParticipantPill
            name={user?.username || user?.name || 'Bạn'}
            label="Micro của bạn"
            dark={dark}
          />
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${statTone}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Chất lượng cuộc gọi</p>
            <p className={`mt-1 text-xs ${mutedText}`}>Độ trễ thấp, âm thanh ổn định</p>
          </div>
          <div className="rounded-full bg-[#dff4e6] px-2.5 py-1 text-xs font-semibold text-[#24834d]">
            Tốt
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['Mic', 'Loa', 'Mạng'].map((item, index) => (
            <div key={item} className={`rounded-xl border px-3 py-2 text-center ${statTone}`}>
              <p className="text-xs font-semibold">{item}</p>
              <div className="mt-2 flex justify-center">
                <SignalBars dark={dark && index === 2} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${statTone}`}>
        <p className="text-sm font-semibold">Thiết bị</p>
        <div className={`mt-3 space-y-2 text-sm ${mutedText}`}>
          <div className="flex items-center gap-2">
            <AppIcon name="mic" className="text-[20px]" />
            Micro mặc định
          </div>
          <div className="flex items-center gap-2">
            <AppIcon name="volume_up" className="text-[20px]" />
            Loa hệ thống
          </div>
          {isVideoCall && (
            <div className="flex items-center gap-2">
              <AppIcon name="videocam" className="text-[20px]" />
              Camera mặc định
            </div>
          )}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 text-xs leading-relaxed ${statTone} ${mutedText}`}>
        <AppIcon name="lock" className="mr-1 align-middle text-[18px]" />
        Cuộc gọi dùng WebRTC peer-to-peer. Server chỉ làm signaling, không giữ nội dung media.
      </div>
    </aside>
  );
}

function WaitingCallView({ partner, isVideoCall, callDuration, callState, onMute, onVideo, onEnd }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <section className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-outline-variant bg-surface shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={onEnd}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Quay lại"
          >
            <AppIcon name="arrow_back" className="text-[20px]" />
          </button>
          <div className="flex items-center gap-3 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-1.5 text-[13px] font-medium text-on-surface">
            <SignalBars />
            <span>{callDuration}</span>
          </div>
        </div>

        <div className="px-8 py-10 text-center">
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
            <span className="absolute h-40 w-40 animate-ping rounded-full bg-accent/15" />
            <span className="absolute h-[136px] w-[136px] rounded-full border border-accent/30" />
            <img
              src={partner.avatar}
              alt={partner.name}
              className="relative h-28 w-28 rounded-full border-[2px] border-surface object-cover shadow-sm"
            />
          </div>

          <h2 className="mt-6 text-[24px] font-medium text-on-surface">{partner.name}</h2>
          <p className="mt-1 text-[15px] text-on-surface-variant">Đang gọi...</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-[14px] font-medium text-on-surface">
            <AppIcon name={isVideoCall ? 'videocam' : 'call'} className="text-[19px]" />
            {isVideoCall ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 px-4 py-6">
          <ControlButton
            label={callState.isMuted ? 'Bật micro' : 'Tắt micro'}
            icon={callState.isMuted ? 'mic_off' : 'mic'}
            active={callState.isMuted}
            onClick={onMute}
          />
          {isVideoCall && (
            <ControlButton
              label={callState.isVideoOff ? 'Bật camera' : 'Tắt camera'}
              icon={callState.isVideoOff ? 'videocam_off' : 'videocam'}
              active={callState.isVideoOff}
              onClick={onVideo}
            />
          )}
          <ControlButton label="Kết thúc" icon="call_end" danger onClick={onEnd} />
        </div>
      </section>
    </div>
  );
}

function AudioCallView({ partner, user, callDuration, callState, onMute, onEnd }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEnd}
              className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              aria-label="Rời cuộc gọi"
            >
              <AppIcon name="arrow_back" className="text-[20px]" />
            </button>
            <div>
              <p className="flex items-center gap-2 text-[16px] font-semibold text-on-surface">
                Cuộc gọi với {partner.name}
                <AppIcon name="lock" className="text-[16px] text-on-surface-variant" />
              </p>
              <p className="text-[12px] text-on-surface-variant">Được mã hóa đầu cuối</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold text-on-surface">
            <SignalBars />
            <span>{callDuration}</span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-5 px-5 py-5 sm:px-8 xl:items-center xl:justify-center">
          <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center">
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
              <span className="absolute h-52 w-52 rounded-full border border-secondary/30" />
              <span className="absolute h-40 w-40 rounded-full bg-secondary/12" />
              <img
                src={partner.avatar}
                alt={partner.name}
                className="relative h-36 w-36 rounded-full border-[2px] border-surface object-cover shadow-sm"
              />
              <span className="absolute bottom-8 right-8 flex h-11 w-11 items-center justify-center rounded-full border-2 border-surface bg-secondary text-surface shadow-sm">
                <AppIcon name="graphic_eq" className="text-[22px]" />
              </span>
            </div>

            <h2 className="mt-7 text-[30px] font-semibold tracking-tight text-on-surface">{partner.name}</h2>
            <p className="mt-2 text-[26px] font-medium tabular-nums text-on-surface">{callDuration}</p>
            <p className="mt-3 flex items-center gap-2 text-[15px] text-on-surface-variant">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              Kết nối tốt
            </p>
            <div className="relative mt-10 h-24 w-full max-w-[560px]">
              <AudioWaveform />
            </div>
          </section>

          <DetailRail partner={partner} user={user} isVideoCall={false} />
        </main>

        <div className="shrink-0 border-t border-outline-variant bg-surface px-4 py-5">
          <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-2 sm:gap-4">
            <ControlButton
              label={callState.isMuted ? 'Bật micro' : 'Tắt micro'}
              icon={callState.isMuted ? 'mic_off' : 'mic'}
              active={callState.isMuted}
              onClick={onMute}
            />
            <ControlButton label="Loa hệ thống" icon="volume_up" disabled />
            <ControlButton label="Thêm người" icon="person_add" disabled />
            <ControlButton label="Kết thúc" icon="call_end" danger onClick={onEnd} />
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoCallView({
  partner,
  user,
  callDuration,
  callState,
  localVideoRef,
  remoteVideoRef,
  remoteStream,
  onMute,
  onVideo,
  onEnd,
}) {
  const hasRemoteVideo = Boolean(remoteStream);
  const pipRef = useRef(null);
  const dragStateRef = useRef(null);
  const [pipPosition, setPipPosition] = useState(null);
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const hasCustomPipPosition = Boolean(pipPosition);

  useEffect(() => {
    if (!hasCustomPipPosition) return undefined;

    const handleResize = () => {
      const pipRect = pipRef.current?.getBoundingClientRect();
      if (!pipRect) return;

      setPipPosition((current) => {
        if (!current) return current;
        return getClampedPipPosition(current.x, current.y, pipRect.width, pipRect.height);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasCustomPipPosition]);

  const startPipDrag = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const pipRect = pipRef.current?.getBoundingClientRect();
    if (!pipRect) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const currentPosition = getClampedPipPosition(
      pipPosition?.x ?? pipRect.left,
      pipPosition?.y ?? pipRect.top,
      pipRect.width,
      pipRect.height,
    );

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: currentPosition.x,
      startY: currentPosition.y,
      width: pipRect.width,
      height: pipRect.height,
    };

    setPipPosition(currentPosition);
    setIsDraggingPip(true);
  };

  const movePipDrag = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.preventDefault();
    const nextX = dragState.startX + event.clientX - dragState.startClientX;
    const nextY = dragState.startY + event.clientY - dragState.startClientY;

    setPipPosition(
      getClampedPipPosition(nextX, nextY, dragState.width, dragState.height),
    );
  };

  const endPipDrag = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStateRef.current = null;
    setIsDraggingPip(false);
  };

  const movePipByKeyboard = (event) => {
    const movementMap = {
      ArrowUp: [0, -18],
      ArrowDown: [0, 18],
      ArrowLeft: [-18, 0],
      ArrowRight: [18, 0],
    };
    const movement = movementMap[event.key];

    if (!movement) return;

    event.preventDefault();
    const pipRect = pipRef.current?.getBoundingClientRect();
    if (!pipRect) return;

    const [deltaX, deltaY] = movement;

    setPipPosition((current) => {
      const baseX = current?.x ?? pipRect.left;
      const baseY = current?.y ?? pipRect.top;
      return getClampedPipPosition(baseX + deltaX, baseY + deltaY, pipRect.width, pipRect.height);
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black text-white">
      <div className="absolute inset-0 xl:right-[334px]">
        {hasRemoteVideo ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-container-highest">
            <div className="text-center">
              <img
                src={partner.avatar}
                alt={partner.name}
                className="mx-auto h-32 w-32 rounded-full border-[2px] border-surface object-cover shadow-sm"
              />
              <h2 className="mt-5 text-[24px] font-medium text-white">{partner.name}</h2>
              <p className="mt-2 text-[14px] text-white/60">Đang chờ video từ người kia</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/0 to-black/60" />
      </div>

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-6 py-6 xl:right-[334px]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEnd}
            className="flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            aria-label="Rời cuộc gọi"
          >
            <AppIcon name="arrow_back" />
          </button>
          <div className="flex items-center gap-3 rounded-full bg-black/40 px-3 py-1.5">
            <img src={partner.avatar} alt={partner.name} className="h-8 w-8 rounded-full object-cover" />
            <div className="min-w-0 pr-2 text-white">
              <p className="truncate text-[14px] font-medium">{partner.name}</p>
              <p className="text-[12px] opacity-70">{callDuration}</p>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={pipRef}
        role="button"
        tabIndex={0}
        aria-label="Di chuyển khung camera của bạn"
        title="Kéo để di chuyển. Nhấp đúp để đưa về góc mặc định."
        onPointerDown={startPipDrag}
        onPointerMove={movePipDrag}
        onPointerUp={endPipDrag}
        onPointerCancel={endPipDrag}
        onDoubleClick={() => setPipPosition(null)}
        onKeyDown={movePipByKeyboard}
        className={`group/pip absolute z-10 h-40 w-28 touch-none select-none overflow-hidden rounded-[16px] border border-white/10 bg-black/40 shadow-md outline-none transition-[transform] sm:h-52 sm:w-36 ${
          pipPosition ? '' : 'bottom-32 right-6 sm:bottom-28 sm:right-8 xl:right-[366px]'
        } ${isDraggingPip ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={pipPosition ? { left: `${pipPosition.x}px`, top: `${pipPosition.y}px` } : undefined}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity ${
            callState.isVideoOff ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {callState.isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-high text-center text-[12px] font-medium text-white/70">
            Camera tắt
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-2 sm:max-w-[calc(100vw-48px)] sm:gap-4 xl:left-[calc(50%-167px)]">
        <ControlButton
          label={callState.isMuted ? 'Bật micro' : 'Tắt micro'}
          icon={callState.isMuted ? 'mic_off' : 'mic'}
          active={callState.isMuted}
          onClick={onMute}
          dark
        />
        <ControlButton
          label={callState.isVideoOff ? 'Bật camera' : 'Tắt camera'}
          icon={callState.isVideoOff ? 'videocam_off' : 'videocam'}
          active={callState.isVideoOff}
          onClick={onVideo}
          dark
        />
        <ControlButton label="Chia sẻ màn hình" icon="screen_share" disabled dark />
        <ControlButton label="Kết thúc" icon="call_end" danger onClick={onEnd} dark />
      </div>

      <div className="absolute bottom-5 right-5 top-5 z-20 hidden xl:block">
        <DetailRail partner={partner} user={user} isVideoCall dark />
      </div>
    </div>
  );
}

const CallOverlay = () => {
  const { user } = useAuth();
  const { callState, callNotice, localStream, remoteStream, endCall, toggleMute, toggleVideo } =
    useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [durationTick, setDurationTick] = useState(() => Date.now());

  const isOverlayVisible = callState.status === 'connected' || callState.status === 'calling';
  const isVideoCall = callState.type === 'video';
  const isConnected = callState.status === 'connected';

  const partner = useMemo(
    () => ({
      name: callState.partner?.name || 'Người gọi',
      avatar: callState.partner?.avatar || AVATAR_FALLBACK,
    }),
    [callState.partner?.avatar, callState.partner?.name],
  );

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

  useEffect(() => {
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = callState.type === 'video' ? null : remoteStream;
  }, [callState.type, remoteStream]);

  useEffect(() => {
    if (!isOverlayVisible || !isConnected) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDurationTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [callState.callId, isConnected, isOverlayVisible]);

  const elapsedSeconds =
    isConnected && callState.connectedAt
      ? Math.max(0, Math.floor((durationTick - callState.connectedAt) / 1000))
      : 0;
  const callDuration = formatDuration(elapsedSeconds);

  if (!isOverlayVisible && !callNotice) return null;

  return (
    <>
      {callNotice && (
        <div className="fixed left-1/2 top-5 z-[120] -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-[14px] font-medium text-on-surface shadow-sm">
          {callNotice}
        </div>
      )}

      {isOverlayVisible && (
        <>
          {!isVideoCall && <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />}

          {callState.status === 'calling' ? (
            <WaitingCallView
              partner={partner}
              isVideoCall={isVideoCall}
              callDuration={callDuration}
              callState={callState}
              onMute={toggleMute}
              onVideo={toggleVideo}
              onEnd={endCall}
            />
          ) : isVideoCall ? (
            <VideoCallView
              partner={partner}
              user={user}
              callDuration={callDuration}
              callState={callState}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              remoteStream={remoteStream}
              onMute={toggleMute}
              onVideo={toggleVideo}
              onEnd={endCall}
            />
          ) : (
            <AudioCallView
              partner={partner}
              user={user}
              callDuration={callDuration}
              callState={callState}
              onMute={toggleMute}
              onEnd={endCall}
            />
          )}
        </>
      )}
    </>
  );
};

export default CallOverlay;
