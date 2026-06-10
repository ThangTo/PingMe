const createSticker = ({ id, name, tags = [], animated = false, width = 320, height = 320 }) => ({
  source: 'builtin',
  packId: '',
  stickerId: id,
  name,
  url: '',
  previewUrl: '',
  animated,
  width,
  height,
  tags,
});

const withPack = (pack) => ({
  ...pack,
  stickers: pack.stickers.map((sticker) => ({
    ...sticker,
    packId: pack.id,
    url: `/stickers/${pack.id}/${sticker.stickerId}.svg`,
    previewUrl: `/stickers/${pack.id}/${sticker.stickerId}.svg`,
  })),
});

export const builtinStickerPacks = [
  withPack({
    id: 'pingme-cute',
    name: 'PingMe Cute',
    description: 'Nhãn dán dễ thương cho cuộc trò chuyện hằng ngày.',
    thumbnail: '/stickers/pingme-cute/happy-bun.svg',
    stickers: [
      createSticker({ id: 'happy-bun', name: 'Vui quá', tags: ['vui', 'cuoi', 'happy', 'cute'] }),
      createSticker({ id: 'heart-bun', name: 'Thả tim', tags: ['tim', 'yeu', 'love', 'heart'], animated: true }),
      createSticker({ id: 'laugh-bun', name: 'Cười xỉu', tags: ['cuoi', 'haha', 'lol'], animated: true }),
      createSticker({ id: 'cry-bun', name: 'Khóc nhè', tags: ['khoc', 'sad', 'buon'] }),
      createSticker({ id: 'shy-bun', name: 'Ngại quá', tags: ['ngai', 'shy', 'cute'] }),
      createSticker({ id: 'ok-bun', name: 'Ok luôn', tags: ['ok', 'dong y', 'yes'] }),
      createSticker({ id: 'thanks-bun', name: 'Cảm ơn nha', tags: ['cam on', 'thanks'] }),
      createSticker({ id: 'hug-bun', name: 'Ôm một cái', tags: ['om', 'hug', 'love'] }),
      createSticker({ id: 'wave-bun', name: 'Xin chào', tags: ['chao', 'hello', 'hi'], animated: true }),
      createSticker({ id: 'wow-bun', name: 'Bất ngờ', tags: ['wow', 'ngac nhien'] }),
      createSticker({ id: 'angry-bun', name: 'Dỗi rồi', tags: ['gian', 'angry', 'doi'] }),
      createSticker({ id: 'sparkle-bun', name: 'Lấp lánh', tags: ['sparkle', 'xinh', 'cute'], animated: true }),
    ],
  }),
  withPack({
    id: 'moods',
    name: 'Moods',
    description: 'Cảm xúc nhanh cho công việc, nhóm và bạn bè.',
    thumbnail: '/stickers/moods/sleepy-mood.svg',
    stickers: [
      createSticker({ id: 'sleepy-mood', name: 'Buồn ngủ', tags: ['ngu', 'sleepy', 'met'] }),
      createSticker({ id: 'work-mood', name: 'Đang làm đây', tags: ['work', 'lam viec', 'busy'] }),
      createSticker({ id: 'done-mood', name: 'Xong rồi', tags: ['done', 'xong', 'ok'], animated: true }),
      createSticker({ id: 'stress-mood', name: 'Bất lực', tags: ['stress', 'bat luc', 'met'] }),
      createSticker({ id: 'party-mood', name: 'Ăn mừng', tags: ['party', 'an mung', 'vui'], animated: true }),
      createSticker({ id: 'coffee-mood', name: 'Cà phê đã', tags: ['coffee', 'ca phe'] }),
      createSticker({ id: 'idea-mood', name: 'Có ý tưởng', tags: ['idea', 'y tuong'], animated: true }),
      createSticker({ id: 'sorry-mood', name: 'Xin lỗi nha', tags: ['sorry', 'xin loi'] }),
      createSticker({ id: 'agree-mood', name: 'Đồng ý', tags: ['dong y', 'agree', 'yes'] }),
      createSticker({ id: 'nope-mood', name: 'Không nha', tags: ['no', 'khong'] }),
      createSticker({ id: 'later-mood', name: 'Để lát nữa', tags: ['later', 'lat nua'] }),
      createSticker({ id: 'focus-mood', name: 'Tập trung', tags: ['focus', 'tap trung', 'work'] }),
    ],
  }),
];

export const builtinStickers = builtinStickerPacks.flatMap((pack) => pack.stickers);

export const builtinStickerById = new Map(
  builtinStickers.map((sticker) => [sticker.stickerId, sticker]),
);

export const builtinStickerByUrl = new Map(builtinStickers.map((sticker) => [sticker.url, sticker]));
