import QRCode from 'qrcode';

const QR_LOGO_SRC = '/brand/logo-trans.png';

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
};

export const createBrandedQrDataUrl = async (value) => {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, value, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#22251f',
      light: '#FBFAF7',
    },
  });

  const context = canvas.getContext('2d');
  if (!context) return canvas.toDataURL('image/png');

  const logo = await loadImage(QR_LOGO_SRC);
  const badgeSize = Math.round(canvas.width * 0.24);
  const logoSize = Math.round(canvas.width * 0.17);
  const badgeX = Math.round((canvas.width - badgeSize) / 2);
  const badgeY = Math.round((canvas.height - badgeSize) / 2);
  const logoX = Math.round((canvas.width - logoSize) / 2);
  const logoY = Math.round((canvas.height - logoSize) / 2);

  context.save();
  drawRoundedRect(context, badgeX, badgeY, badgeSize, badgeSize, Math.round(badgeSize * 0.24));
  context.fillStyle = '#FBFAF7';
  context.fill();
  context.lineWidth = Math.max(2, Math.round(canvas.width * 0.008));
  context.strokeStyle = '#DED8CE';
  context.stroke();
  context.drawImage(logo, logoX, logoY, logoSize, logoSize);
  context.restore();

  return canvas.toDataURL('image/png');
};
