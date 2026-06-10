import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public/stickers');

const packs = [
  {
    id: 'pingme-cute',
    name: 'PingMe Cute',
    description: 'Nhãn dán dễ thương cho cuộc trò chuyện hằng ngày.',
    theme: '#f7d8e8',
    accent: '#2f8f5b',
    stickers: [
      ['happy-bun', 'Vui quá', '😊', false],
      ['heart-bun', 'Thả tim', '💚', true],
      ['laugh-bun', 'Cười xỉu', '😂', true],
      ['cry-bun', 'Khóc nhè', '🥹', false],
      ['shy-bun', 'Ngại quá', '☺️', false],
      ['ok-bun', 'Ok luôn', '👌', false],
      ['thanks-bun', 'Cảm ơn nha', '🙏', false],
      ['hug-bun', 'Ôm một cái', '🤗', false],
      ['wave-bun', 'Xin chào', '👋', true],
      ['wow-bun', 'Bất ngờ', '😮', false],
      ['angry-bun', 'Dỗi rồi', '😤', false],
      ['sparkle-bun', 'Lấp lánh', '✨', true],
    ],
  },
  {
    id: 'moods',
    name: 'Moods',
    description: 'Cảm xúc nhanh cho công việc, nhóm và bạn bè.',
    theme: '#e5dbc8',
    accent: '#b99068',
    stickers: [
      ['sleepy-mood', 'Buồn ngủ', '😴', false],
      ['work-mood', 'Đang làm đây', '💻', false],
      ['done-mood', 'Xong rồi', '✅', true],
      ['stress-mood', 'Bất lực', '🫠', false],
      ['party-mood', 'Ăn mừng', '🎉', true],
      ['coffee-mood', 'Cà phê đã', '☕', false],
      ['idea-mood', 'Có ý tưởng', '💡', true],
      ['sorry-mood', 'Xin lỗi nha', '🙇', false],
      ['agree-mood', 'Đồng ý', '👍', false],
      ['nope-mood', 'Không nha', '🙅', false],
      ['later-mood', 'Để lát nữa', '⏳', false],
      ['focus-mood', 'Tập trung', '🎧', false],
    ],
  },
];

const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const stickerSvg = ({ id, name, emoji, animated, theme, accent }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title">
  <title id="${id}-title">${escapeXml(name)}</title>
  <defs>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#2a2520" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="320" height="320" fill="transparent"/>
  <g filter="url(#softShadow)"${animated ? '>' : '>'}
    ${
      animated
        ? '<animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines=".42 0 .58 1; .42 0 .58 1"/>'
        : ''
    }
    <path d="M82 68C118 29 207 27 242 71C284 123 269 225 203 257C143 286 65 252 48 188C38 149 50 102 82 68Z" fill="${theme}" stroke="#2a2520" stroke-opacity="0.12" stroke-width="4"/>
    <circle cx="106" cy="122" r="14" fill="#2a2520" fill-opacity="0.18"/>
    <circle cx="213" cy="122" r="14" fill="#2a2520" fill-opacity="0.18"/>
    <path d="M119 188C138 208 181 210 202 188" stroke="${accent}" stroke-width="12" stroke-linecap="round"/>
    <text x="160" y="178" text-anchor="middle" dominant-baseline="middle" font-size="86" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${escapeXml(emoji)}</text>
    <text x="160" y="274" text-anchor="middle" font-size="22" font-weight="800" font-family="Inter, Arial, sans-serif" fill="#2a2520">${escapeXml(name)}</text>
  </g>
</svg>
`;

fs.mkdirSync(publicDir, { recursive: true });

const manifest = packs.map((pack) => {
  const packDir = path.join(publicDir, pack.id);
  fs.rmSync(packDir, { recursive: true, force: true });
  fs.mkdirSync(packDir, { recursive: true });

  const stickers = pack.stickers.map(([id, name, emoji, animated]) => {
    const filePath = path.join(packDir, `${id}.svg`);
    fs.writeFileSync(
      filePath,
      stickerSvg({ id, name, emoji, animated, theme: pack.theme, accent: pack.accent }),
      'utf8',
    );

    return {
      source: 'builtin',
      packId: pack.id,
      stickerId: id,
      name,
      url: `/stickers/${pack.id}/${id}.svg`,
      previewUrl: `/stickers/${pack.id}/${id}.svg`,
      animated,
      width: 320,
      height: 320,
    };
  });

  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    thumbnail: stickers[0]?.url || '',
    stickers,
  };
});

fs.writeFileSync(path.join(publicDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${manifest.reduce((sum, pack) => sum + pack.stickers.length, 0)} stickers.`);
