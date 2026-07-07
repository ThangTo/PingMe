import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import { withRedirectParam } from '../utils/authRedirect';
import Avatar from '../components/ui/Avatar';
import AppIcon from '../components/ui/AppIcon';
import PingMeLogo from '../components/ui/PingMeLogo';
import PingMeWordmark from '../components/ui/PingMeWordmark';
import LoadingState from '../components/ui/LoadingState';

const ERROR_MESSAGES = {
  not_found: 'Liên kết mời không tồn tại hoặc đã bị xoá.',
  revoked: 'Liên kết mời này đã bị huỷ bởi admin nhóm.',
  expired: 'Liên kết mời này đã hết hạn.',
  maxed: 'Liên kết mời này đã đạt giới hạn số lần sử dụng.',
  default: 'Liên kết mời không hợp lệ.',
};

function InviteLandingPage() {
  const { token } = useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState('loading'); // loading | invalid | not_logged_in | already_member | can_join
  const [data, setData] = useState(null);
  const [invalidReason, setInvalidReason] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  const redirectPath = `/invite/${token}`;

  useEffect(() => {
    if (authLoading) return;

    const fetchPreview = async () => {
      try {
        const res = await api.get(`/invite/${token}`);
        const preview = res.data;
        setData(preview);

        if (!isAuthenticated) {
          setState('not_logged_in');
        } else if (preview.isAlreadyMember) {
          setState('already_member');
        } else {
          setState('can_join');
        }
      } catch (err) {
        const reason = err.response?.data?.reason || 'default';
        setInvalidReason(reason);
        setState('invalid');
      }
    };

    fetchPreview();
  }, [token, isAuthenticated, authLoading]);

  const handleJoin = async () => {
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await api.post(`/invite/${token}/join`);
      const conversationId = res.data.conversationId;
      navigate(`/chat?conversationId=${conversationId}`, { replace: true });
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Không thể tham gia nhóm. Vui lòng thử lại.');
      setIsJoining(false);
    }
  };

  const handleGoToGroup = () => {
    navigate(`/chat?conversationId=${data?.group?.id}`, { replace: true });
  };

  if (authLoading || state === 'loading') {
    return <LoadingState fullscreen label="Đang tải..." />;
  }

  return (
    <main className="min-h-dvh bg-surface-container-lowest text-on-surface">
      <header className="mx-auto flex h-16 max-w-[640px] items-center justify-between px-5">
        <Link to="/chat" className="flex items-center gap-2 font-semibold text-on-surface">
          <PingMeLogo size="sm" />
          <PingMeWordmark size="md" className="-ml-1" />
        </Link>
        {!isAuthenticated && (
          <Link
            to={withRedirectParam('/login', redirectPath)}
            className="rounded-[8px] border border-outline bg-surface px-3 py-2 text-[12px] font-semibold text-on-surface hover:bg-surface-container-low"
          >
            Đăng nhập
          </Link>
        )}
      </header>

      <section className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-[640px] flex-col items-center justify-center px-5 py-12">
        {state === 'invalid' && (
          <div className="flex w-full max-w-[400px] flex-col items-center gap-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-error/10">
              <AppIcon name="link_off" className="text-[32px] text-error" />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-on-surface">Liên kết không hợp lệ</h1>
              <p className="mt-2 text-[14px] leading-6 text-on-surface-variant">
                {ERROR_MESSAGES[invalidReason] || ERROR_MESSAGES.default}
              </p>
            </div>
            <Link
              to="/chat"
              className="rounded-[8px] bg-primary px-5 py-2.5 text-[14px] font-semibold text-on-primary hover:opacity-90"
            >
              Về trang chủ
            </Link>
          </div>
        )}

        {(state === 'not_logged_in' || state === 'already_member' || state === 'can_join') && data && (
          <div className="flex w-full max-w-[400px] flex-col items-center gap-6">
            {/* Group card */}
            <div className="flex w-full flex-col items-center gap-4 rounded-[16px] border border-outline-variant bg-surface p-8 text-center">
              <Avatar
                src={data.group.avatar}
                name={data.group.title}
                size="xl"
                className="h-20 w-20 text-[28px]"
              />
              <div>
                <h1 className="text-[20px] font-semibold text-on-surface">{data.group.title}</h1>
                <p className="mt-1 text-[13px] text-on-surface-variant">
                  {data.group.memberCount} thành viên
                  {data.createdBy && (
                    <span> · Mời bởi {data.createdBy.username}</span>
                  )}
                </p>
              </div>

              {data.expiresAt && (
                <p className="text-[12px] text-on-surface-variant">
                  Hết hạn {new Date(data.expiresAt).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>

            {/* Action area */}
            {state === 'not_logged_in' && (
              <div className="flex w-full flex-col gap-3">
                <Link
                  to={withRedirectParam('/login', redirectPath)}
                  className="flex h-12 w-full items-center justify-center rounded-[10px] bg-primary text-[14px] font-semibold text-on-primary hover:opacity-90"
                >
                  Đăng nhập để tham gia
                </Link>
                <Link
                  to={withRedirectParam('/register', redirectPath)}
                  className="flex h-12 w-full items-center justify-center rounded-[10px] border border-outline text-[14px] font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  Đăng ký tài khoản mới
                </Link>
              </div>
            )}

            {state === 'already_member' && (
              <div className="flex w-full flex-col items-center gap-3">
                <p className="text-[13px] text-on-surface-variant">Bạn đã là thành viên của nhóm này.</p>
                <button
                  onClick={handleGoToGroup}
                  className="flex h-12 w-full items-center justify-center rounded-[10px] bg-primary text-[14px] font-semibold text-on-primary hover:opacity-90"
                >
                  Vào nhóm
                </button>
              </div>
            )}

            {state === 'can_join' && (
              <div className="flex w-full flex-col gap-3">
                {joinError && (
                  <p className="text-center text-[13px] text-error">{joinError}</p>
                )}
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[14px] font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
                >
                  {isJoining ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
                      Đang tham gia...
                    </>
                  ) : (
                    'Tham gia nhóm'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default InviteLandingPage;
