import AppIcon from '../ui/AppIcon';

const people = [
  { initials: 'LA', name: 'Lan Anh', message: 'Mai team mình họp lúc 9h nhé!', time: '09:24', online: true },
  { initials: 'HN', name: 'Hoàng Nam', message: 'Đã gửi file báo cáo Q2 cho bạn rồi.', time: '09:28' },
  { initials: 'PT', name: 'Project Team', message: 'Huy: Mọi người xem kế hoạch mới nhé.', time: '09:35', group: true },
  { initials: 'TH', name: 'Thu Hà', message: 'Cuộc gọi video đã kết thúc · 0:11', time: '09:42', online: true },
];

function PreviewAvatar({ initials, online = false, group = false, small = false }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full border border-outline-variant font-semibold ${
        small ? 'h-7 w-7 text-[9px]' : 'h-10 w-10 text-[11px]'
      } ${group ? 'bg-[#ded8cb] text-[#39362f]' : 'bg-surface-container-high text-on-surface'}`}
    >
      {initials}
      {online && (
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-secondary" />
      )}
    </span>
  );
}

function ConversationRow({ person, selected = false, compact = false }) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-outline-variant ${
        compact ? 'px-3 py-2.5' : 'px-1 py-4'
      } ${selected ? 'bg-surface-container-high' : ''}`}
    >
      <PreviewAvatar {...person} small={compact} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate font-semibold text-on-surface ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
            {person.name}
          </p>
          <span className="shrink-0 text-[9px] text-on-surface-variant">{person.time}</span>
        </div>
        <p className={`truncate text-on-surface-variant ${compact ? 'mt-0.5 text-[9px]' : 'mt-1 text-[11px]'}`}>
          {person.message}
        </p>
      </div>
      {selected && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-secondary px-1 text-[9px] font-semibold text-white">
          5
        </span>
      )}
    </div>
  );
}

function FileCard({ compact = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[10px] border border-outline-variant bg-surface-container px-3 py-2.5 ${
        compact ? 'max-w-[172px]' : 'max-w-[235px]'
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-container-high text-on-surface">
        <AppIcon name="inventory_2" className="text-[18px]" />
      </span>
      <div className="min-w-0">
        <p className={`truncate font-medium text-on-surface ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
          Bao_cao_Q2_2024.pdf
        </p>
        <p className="mt-0.5 text-[9px] text-on-surface-variant">2.4 MB · PDF</p>
      </div>
    </div>
  );
}

function Composer({ compact = false }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[10px] border border-outline-variant bg-surface-container-lowest px-2.5 ${
        compact ? 'h-9' : 'h-11'
      }`}
    >
      <AppIcon name="attach_file" className="text-[16px] text-on-surface-variant" />
      <span className={`flex-1 text-on-surface-variant ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
        Nhập tin nhắn...
      </span>
      <AppIcon name="sentiment_satisfied" className="text-[16px] text-on-surface-variant" />
      <span
        className={`grid place-items-center rounded-full bg-secondary text-white ${
          compact ? 'h-6 w-6' : 'h-7 w-7'
        }`}
      >
        <AppIcon name="send" className="text-[13px]" />
      </span>
    </div>
  );
}

function LoginPreview() {
  return (
    <div className="flex h-full flex-col px-7 pb-6 pt-7 lg:px-9">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-on-surface">Xem trước PingMe</h2>
          <p className="mt-1 text-[11px] text-on-surface-variant">Trò chuyện thật, kết nối thật</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-secondary/25 bg-secondary-container px-3 py-1.5 text-[10px] font-medium text-secondary">
          <span className="h-2 w-2 rounded-full bg-secondary" />
          Đang online
        </span>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-hidden">
        {people.map((person, index) => (
          <div key={person.name}>
            <ConversationRow person={person} />
            {index === 1 && (
              <div className="mb-2 ml-[52px] mt-[-4px]">
                <FileCard />
              </div>
            )}
            {index === 1 && (
              <div className="mb-3 flex justify-end">
                <div className="max-w-[250px] rounded-[12px] rounded-br-[4px] border border-secondary/20 bg-secondary-container px-3 py-2.5">
                  <p className="text-[11px] text-on-surface">Cảm ơn bạn, mình xem qua rồi.</p>
                  <p className="mt-1 text-right text-[9px] text-on-surface-variant">09:31 ✓✓</p>
                </div>
              </div>
            )}
            {index === 3 && (
              <div className="ml-[52px] mt-[-6px] flex items-center gap-1.5">
                <span className="rounded-full border border-outline-variant bg-surface-container px-2 py-1 text-[10px]">
                  👍 ❤️ 🙂 😮
                </span>
                <span className="text-[9px] text-on-surface-variant">3</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <Composer />
    </div>
  );
}

function RegisterPreview() {
  const previewPeople = people.concat([
    { initials: 'TK', name: 'Trung Kiên', message: 'Sticker', time: 'Hôm qua' },
    { initials: 'GĐ', name: 'Gia đình', message: 'Mẹ: Tối nay ăn cơm sớm nhé', time: 'Hôm qua', group: true },
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 items-center border-b border-outline-variant px-4">
        <p className="text-[12px] font-medium text-on-surface">Xem trước PingMe</p>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[43%_57%]">
        <div className="flex min-h-0 flex-col border-r border-outline-variant">
          <div className="p-3">
            <div className="flex h-8 items-center gap-2 rounded-[8px] bg-surface-container-low px-2.5 text-[9px] text-on-surface-variant">
              <AppIcon name="search" className="text-[13px]" />
              Tìm kiếm
            </div>
            <div className="mt-2 flex items-center justify-between text-[8px] text-on-surface-variant">
              <span className="rounded-[6px] bg-secondary-container px-2 py-1 text-secondary">Tất cả</span>
              <span>Chưa đọc</span>
              <span>Nhóm</span>
              <span>Bạn bè</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewPeople.map((person, index) => (
              <ConversationRow key={`${person.name}-${index}`} person={person} compact selected={index === 2} />
            ))}
          </div>
          <div className="grid h-11 grid-cols-4 border-t border-outline-variant text-on-surface-variant">
            {['mode_comment', 'person', 'notifications', 'settings'].map((icon, index) => (
              <span key={icon} className={`grid place-items-center ${index === 0 ? 'text-secondary' : ''}`}>
                <AppIcon name={icon} className="text-[15px]" />
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-12 items-center gap-2 border-b border-outline-variant px-3">
            <PreviewAvatar initials="NW" group small />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold text-on-surface">Nhóm Dự án Web</p>
              <p className="text-[8px] text-secondary">8 thành viên</p>
            </div>
            <AppIcon name="call" className="text-[14px]" />
            <AppIcon name="videocam" className="text-[14px]" />
            <AppIcon name="more_vert" className="text-[14px]" />
          </div>
          <div className="border-b border-outline-variant bg-surface-container-low px-3 py-2">
            <p className="text-[8px] font-medium text-on-surface">Tin nhắn đã ghim</p>
            <p className="mt-0.5 truncate text-[7px] text-on-surface-variant">
              Minh Quân: Deadline 30/06 cho bản thiết kế mới
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
            <div className="flex gap-2">
              <PreviewAvatar initials="MQ" small />
              <div className="rounded-[10px] rounded-bl-[3px] border border-outline-variant bg-surface-container px-2.5 py-2">
                <p className="text-[8px] font-medium text-secondary">Minh Quân</p>
                <p className="mt-1 text-[9px] text-on-surface">Mọi người xem cập nhật bản thiết kế mới nhé.</p>
              </div>
            </div>
            <div className="ml-9">
              <FileCard compact />
            </div>
            <div className="flex gap-2">
              <PreviewAvatar initials="LA" online small />
              <div className="rounded-[10px] rounded-bl-[3px] border border-outline-variant bg-surface-container px-2.5 py-2">
                <p className="text-[8px] font-medium text-secondary">Lan Anh</p>
                <p className="mt-1 text-[9px] text-on-surface">Đẹp quá! Mình thích phong cách mới này.</p>
              </div>
            </div>
            <div className="ml-auto max-w-[180px] rounded-[10px] rounded-br-[3px] border border-secondary/20 bg-secondary-container px-2.5 py-2">
              <p className="text-[8px] font-medium text-secondary">Thắng Tô</p>
              <p className="mt-1 text-[9px] text-on-surface">OK, mình sẽ triển khai phần chat trước nhé.</p>
            </div>
          </div>
          <div className="p-3">
            <Composer compact />
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview chỉ mô phỏng sản phẩm trong màn auth, không nối vào dữ liệu hoặc Socket.IO.
export default function AuthPreview({ variant = 'login' }) {
  return variant === 'register' ? <RegisterPreview /> : <LoginPreview />;
}
