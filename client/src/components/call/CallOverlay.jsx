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
    <div className="absolute inset-x-0 top-1/2 -z-10 hidden -translate-y-1/2 items-center justify-center gap-2 opacity-70 sm:flex">
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
    ? 'border-white/15 bg-white/[0.12] text-white hover:bg-white/20'
    : 'border-[#e4d7c9] bg-white/80 text-[#3a332d] hover:bg-white';
  const activeTone = dark
    ? 'border-[#f5c8c1] bg-[#ef4d42] text-white'
    : 'border-[#f1c9c2] bg-[#fff0ee] text-[#cf3529]';
  const dangerTone = 'border-[#ef4d42] bg-[#ef4d42] text-white hover:bg-[#df4035]';
  const disabledTone = dark
    ? 'cursor-not-allowed border-white/10 bg-white/[0.08] text-white/35'
    : 'cursor-not-allowed border-[#e9dfd4] bg-[#f7f1ea] text-[#aa9d90]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border shadow-[0_12px_30px_rgba(58,43,30,0.12)] transition ${
        disabled ? disabledTone : danger ? dangerTone : active ? activeTone : baseTone
      }`}
    >
      <AppIcon name={icon} className="text-[26px]" />
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
    ? 'border-white/10 bg-[#151515]/75 text-white backdrop-blur-xl'
    : 'border-[#eadfd2] bg-[#fbf8f1]/82 text-[#2d2823] backdrop-blur-xl';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211b16]/45 px-4 py-6 backdrop-blur-md">
      <section className="w-full max-w-[600px] overflow-hidden rounded-[30px] border border-[#e3d8ca] bg-[#fbf8f1] shadow-[0_32px_100px_rgba(58,45,35,0.32)]">
        <div className="flex items-center justify-between border-b border-[#eee5d8] px-6 py-4">
          <button
            type="button"
            onClick={onEnd}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e5dbce] bg-white/70 text-[#4f4338] transition hover:bg-white"
            aria-label="Quay lại"
          >
            <AppIcon name="arrow_back" />
          </button>
          <div className="flex items-center gap-3 rounded-full border border-[#e5dbce] bg-white/70 px-4 py-2 text-sm font-medium text-[#5f544a]">
            <SignalBars />
            <span>{callDuration}</span>
          </div>
        </div>

        <div className="px-8 py-10 text-center">
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
            <span className="absolute h-40 w-40 animate-ping rounded-full bg-[#b69370]/15" />
            <span className="absolute h-[136px] w-[136px] rounded-full border border-[#d7c5b4]" />
            <img
              src={partner.avatar}
              alt={partner.name}
              className="relative h-28 w-28 rounded-full border-4 border-[#fbf8f1] object-cover shadow-[0_18px_45px_rgba(73,55,38,0.26)]"
            />
            <span className="absolute bottom-10 right-10 h-4 w-4 rounded-full border-2 border-[#fbf8f1] bg-[#40b36b]" />
          </div>

          <h2 className="mt-6 text-3xl font-semibold text-[#211d19]">{partner.name}</h2>
          <p className="mt-2 text-sm text-[#6f6256]">Đang gọi...</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e2d7ca] bg-white/75 px-4 py-2 text-sm font-medium text-[#5f544a]">
            <AppIcon name={isVideoCall ? 'videocam' : 'call'} className="text-[19px]" />
            {isVideoCall ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
          </div>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-[#817266]">
            <AppIcon name="lock" className="mr-1 align-middle text-[18px]" />
            Đang chờ người kia nhận cuộc gọi. Kết nối media sẽ bắt đầu sau khi được chấp nhận.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-[#eee5d8] px-4 py-5">
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#fbf8f1]">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#eadfd2] px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEnd}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4d7c9] bg-white/75 text-[#4f4338] transition hover:bg-white"
              aria-label="Rời cuộc gọi"
            >
              <AppIcon name="arrow_back" />
            </button>
            <div>
              <p className="text-base font-semibold text-[#211d19]">PingMe Call</p>
              <p className="text-xs text-[#817266]">Cuộc gọi thoại riêng tư</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e4d7c9] bg-white/75 px-3 py-2 text-sm font-semibold text-[#5f544a]">
            <SignalBars />
            <span>{callDuration}</span>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-5 py-5 sm:px-8 xl:grid-cols-[1fr_auto]">
          <section className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-[30px] border border-[#eadfd2] bg-[#f7efe6] px-5 py-8 text-center">
            <AudioWaveform />
            <div className="relative flex h-48 w-48 items-center justify-center">
              <span className="absolute h-44 w-44 rounded-full border border-[#d5c2b0]" />
              <span className="absolute h-36 w-36 rounded-full bg-[#e5d4c2]" />
              <img
                src={partner.avatar}
                alt={partner.name}
                className="relative h-28 w-28 rounded-full border-4 border-[#f7efe6] object-cover shadow-[0_20px_50px_rgba(84,65,45,0.24)]"
              />
              <span className="absolute bottom-11 right-11 h-4 w-4 rounded-full border-2 border-[#f7efe6] bg-[#40b36b]" />
            </div>

            <h2 className="mt-7 text-4xl font-semibold text-[#211d19]">{partner.name}</h2>
            <p className="mt-2 text-sm font-medium text-[#7b6d60]">Đang gọi thoại</p>
            <div className="mt-5 rounded-full border border-[#e0d0bf] bg-white/75 px-5 py-2 text-sm font-semibold text-[#5b4f45]">
              {callDuration}
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-[#817266]">
              <AppIcon name="lock" className="mr-1 align-middle text-[18px]" />
              Âm thanh đi trực tiếp giữa hai thiết bị sau bước signaling.
            </p>
          </section>

          <DetailRail partner={partner} user={user} isVideoCall={false} />
        </main>

        <div className="shrink-0 px-4 pb-5">
          <div className="mx-auto flex w-fit max-w-full items-center gap-3 overflow-x-auto rounded-[26px] border border-[#e4d7c9] bg-white/78 p-3 shadow-[0_18px_55px_rgba(69,53,38,0.18)] backdrop-blur-xl">
            <ControlButton
              label={callState.isMuted ? 'Bật micro' : 'Tắt micro'}
              icon={callState.isMuted ? 'mic_off' : 'mic'}
              active={callState.isMuted}
              onClick={onMute}
            />
            <ControlButton label="Loa hệ thống" icon="volume_up" disabled />
            <ControlButton label="Thêm người" icon="person_add" disabled />
            <ControlButton label="Chuyển sang video" icon="videocam" disabled />
            <ControlButton label="Tuỳ chọn" icon="more_horiz" disabled />
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0f0f0e] text-white">
      <div className="absolute inset-0">
        {hasRemoteVideo ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,#3a3027_0%,#11100f_55%,#070707_100%)]">
            <div className="text-center">
              <img
                src={partner.avatar}
                alt={partner.name}
                className="mx-auto h-32 w-32 rounded-full border-4 border-white/10 object-cover shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
              />
              <h2 className="mt-5 text-3xl font-semibold">{partner.name}</h2>
              <p className="mt-2 text-sm text-white/60">Đang chờ video từ người kia</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/55" />
      </div>

      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl">
          <button
            type="button"
            onClick={onEnd}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.12] text-white transition hover:bg-white/[0.22]"
            aria-label="Rời cuộc gọi"
          >
            <AppIcon name="arrow_back" />
          </button>
          <img src={partner.avatar} alt={partner.name} className="h-10 w-10 rounded-full object-cover" />
          <div className="min-w-0 pr-2">
            <p className="truncate text-sm font-semibold">{partner.name}</p>
            <p className="text-xs text-white/[0.62]">{callDuration}</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm font-semibold backdrop-blur-xl sm:flex">
          <SignalBars dark />
          <span>HD · Kết nối tốt</span>
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
        className={`group/pip absolute z-10 h-36 w-[104px] touch-none select-none overflow-hidden rounded-[22px] border border-white/[0.16] bg-black/40 shadow-[0_18px_55px_rgba(0,0,0,0.34)] outline-none transition-[box-shadow,border-color,transform] focus-visible:border-white/45 focus-visible:ring-2 focus-visible:ring-white/35 sm:h-52 sm:w-36 ${
          pipPosition ? '' : 'bottom-28 right-4 sm:bottom-24 sm:right-6'
        } ${isDraggingPip ? 'cursor-grabbing border-white/45 ring-2 ring-white/30' : 'cursor-grab'}`}
        style={pipPosition ? { left: `${pipPosition.x}px`, top: `${pipPosition.y}px` } : undefined}
      >
        <span className="pointer-events-none absolute left-1/2 top-1.5 z-20 grid -translate-x-1/2 grid-cols-3 gap-0.5 rounded-full bg-black/28 px-2 py-1 opacity-0 backdrop-blur-sm transition-opacity group-hover/pip:opacity-100 group-focus/pip:opacity-100">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="h-0.5 w-0.5 rounded-full bg-white/80" />
          ))}
        </span>
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
          <div className="absolute inset-0 flex items-center justify-center bg-[#2b2521] text-center text-xs font-semibold text-white/70">
            Camera tắt
          </div>
        )}
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-3 overflow-x-auto rounded-[26px] border border-white/[0.12] bg-black/[0.32] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
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
        <ControlButton label="Tuỳ chọn" icon="more_horiz" disabled dark />
        <ControlButton label="Kết thúc" icon="call_end" danger onClick={onEnd} dark />
      </div>

      <div className="absolute right-5 top-24 z-10 hidden xl:block">
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
        <div className="fixed left-1/2 top-5 z-[120] -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface shadow-[0_14px_36px_rgba(40,37,32,0.18)]">
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
