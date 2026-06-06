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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f1b16]/45 px-4 py-6 backdrop-blur-md">
      <div className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#e5dbce] bg-[#fbf8f1] shadow-[0_30px_90px_rgba(62,49,37,0.28)]">
        <div className="flex items-center justify-between border-b border-[#eee5d8] px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2f2923]">
            <AppIcon name="mode_comment" />
            PingMe
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e1d6c9] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#6f6256]">
            <span className="h-2 w-2 rounded-full bg-[#40b36b]" />
            Kết nối tốt
          </div>
        </div>

        <div className="px-7 py-8 text-center sm:px-10">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
            <span className="absolute h-32 w-32 animate-ping rounded-full bg-[#b69370]/15" />
            <span className="absolute h-28 w-28 rounded-full border border-[#d9cabb]" />
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="relative h-24 w-24 rounded-full border-4 border-[#fbf8f1] object-cover shadow-[0_14px_40px_rgba(83,66,48,0.22)]"
            />
            <span className="absolute bottom-7 right-7 h-4 w-4 rounded-full border-2 border-[#fbf8f1] bg-[#40b36b]" />
          </div>

          <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-[#9a826c]">
            Cuộc gọi đến
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#211d19] sm:text-3xl">{partnerName}</h2>
          <p className="mt-2 text-sm text-[#6f6256]">
            {isVideoCall ? 'Đang mời bạn vào cuộc gọi video' : 'Đang gọi thoại cho bạn'}
          </p>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#e2d7ca] bg-white/70 px-4 py-2 text-sm font-medium text-[#5f544a]">
            <AppIcon name={isVideoCall ? 'videocam' : 'call'} />
            {isVideoCall ? 'Camera sẽ bật sau khi nhận' : 'Micro sẽ bật sau khi nhận'}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setIsSilenced((value) => !value)}
              className={`flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition ${
                isSilenced
                  ? 'border-[#b69370] bg-[#efe5da] text-[#6a4c31]'
                  : 'border-[#e5dbce] bg-white/70 text-[#51473f] hover:border-[#d2bfaa] hover:bg-white'
              }`}
            >
              <AppIcon name={isSilenced ? 'notifications_off' : 'notifications'} />
              {isSilenced ? 'Đã tắt' : 'Tắt chuông'}
            </button>

            <button
              type="button"
              onClick={rejectCall}
              className="flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#f1c9c2] bg-[#fff2f0] px-3 text-sm font-semibold text-[#d83b2d] transition hover:bg-[#ffe7e3]"
            >
              <AppIcon name="call_end" />
              Từ chối
            </button>

            <button
              type="button"
              onClick={acceptCall}
              className="flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#cfe7d6] bg-[#eaf7ee] px-3 text-sm font-semibold text-[#23834d] transition hover:bg-[#dbf1e3]"
            >
              <AppIcon name={isVideoCall ? 'videocam' : 'call'} />
              Nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncomingCallModal
