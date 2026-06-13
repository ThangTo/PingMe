import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProfileViewer from '../components/profile/ProfileViewer';
import PingMeLogo from '../components/ui/PingMeLogo';
import PingMeWordmark from '../components/ui/PingMeWordmark';

const normalizePingId = (value = '') => value.replace(/^@+/, '').toLowerCase();

function PublicProfilePage() {
  const { pingId = '' } = useParams();
  const normalizedPingId = useMemo(() => normalizePingId(pingId), [pingId]);

  return (
    <main className="min-h-dvh bg-surface-container-lowest text-on-surface">
      <header className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-5">
        <Link to="/chat" className="flex items-center gap-2 font-semibold text-on-surface">
          <PingMeLogo size="sm" />
          <PingMeWordmark size="md" className="-ml-1" />
        </Link>
        <Link
          to="/chat"
          className="rounded-[8px] border border-outline bg-surface px-3 py-2 text-[12px] font-semibold text-on-surface hover:bg-surface-container-low"
        >
          Mở PingMe
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-[1040px] items-center gap-8 px-5 py-8 md:grid-cols-[minmax(0,1fr)_380px]">
        <div className="max-w-[560px]">
          <p className="text-[12px] font-semibold uppercase text-secondary">PingMe Profile</p>
          <h1 className="mt-4 text-[38px] font-semibold leading-tight tracking-normal text-on-surface md:text-[52px]">
            Kết nối nhanh bằng PingMe ID.
          </h1>
          <p className="mt-5 text-[15px] leading-7 text-on-surface-variant">
            Xem hồ sơ công khai, đăng nhập nếu cần, rồi gửi lời mời hoặc mở cuộc trò chuyện khi hai bên đã kết nối.
          </p>
        </div>

        <ProfileViewer pingId={normalizedPingId} className="quiet-shadow" />
      </section>
    </main>
  );
}

export default PublicProfilePage;
