import { useState } from 'react'
import { useCall } from '../../context/CallContext'
import AppIcon from '../ui/AppIcon';

const AVATAR_FALLBACK =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80'

function IncomingCallModal() {
  const { callState, acceptCall, rejectCall } = useCall()
  const [isSilenced, setIsSilenced] = useState(false)

  if (callState.status !== 'ringing') return null

  const isVideoCall = callState.type === 'video'
  const partnerName = callState.partner?.name || 'Người gọi'
  const partnerAvatar = callState.partner?.avatar || AVATAR_FALLBACK

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-outline-variant bg-surface shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-[14px] font-medium text-on-surface">
            <AppIcon name="mode_comment" className="text-[18px]" />
            PingMe
          </div>
          <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-[12px] font-medium text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
            Kết nối tốt
          </div>
        </div>

        <div className="px-7 py-8 text-center sm:px-10">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
            <span className="absolute h-32 w-32 animate-ping rounded-full bg-accent/15" />
            <span className="absolute h-28 w-28 rounded-full border border-accent/30" />
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="relative h-24 w-24 rounded-full border-[2px] border-surface object-cover shadow-sm"
            />
          </div>

          <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.08em] text-on-surface-variant">
            Cuộc gọi đến
          </p>
          <h2 className="mt-2 text-[24px] font-medium text-on-surface">{partnerName}</h2>
          <p className="mt-1 text-[15px] text-on-surface-variant">
            {isVideoCall ? 'Đang mời bạn vào cuộc gọi video' : 'Đang gọi thoại cho bạn'}
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIsSilenced((value) => !value)}
              aria-label={isSilenced ? 'Bật chuông' : 'Tắt chuông'}
              title={isSilenced ? 'Bật chuông' : 'Tắt chuông'}
              className={`flex h-[74px] min-w-[82px] flex-col items-center justify-center gap-1.5 rounded-[18px] px-3 text-[12px] font-medium transition-colors ${
                isSilenced
                  ? 'bg-surface-container-high text-on-surface'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <AppIcon name={isSilenced ? 'notifications_off' : 'notifications'} className="text-[24px]" />
              <span>{isSilenced ? 'Bật chuông' : 'Tắt chuông'}</span>
            </button>

            <button
              type="button"
              onClick={rejectCall}
              aria-label="Từ chối"
              title="Từ chối"
              className="flex h-[74px] min-w-[82px] flex-col items-center justify-center gap-1.5 rounded-[18px] bg-error px-3 text-[12px] font-medium text-surface transition-colors hover:bg-error/90"
            >
              <AppIcon name="call_end" className="text-[24px]" />
              <span>Từ chối</span>
            </button>

            <button
              type="button"
              onClick={acceptCall}
              aria-label="Trả lời"
              title="Trả lời"
              className="flex h-[74px] min-w-[82px] flex-col items-center justify-center gap-1.5 rounded-[18px] bg-[#10b981] px-3 text-[12px] font-medium text-surface transition-colors hover:bg-[#10b981]/90"
            >
              <AppIcon name={isVideoCall ? 'videocam' : 'call'} className="text-[24px]" />
              <span>Trả lời</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncomingCallModal
