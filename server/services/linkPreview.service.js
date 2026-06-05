import dns from 'dns/promises';
import net from 'net';
import Message from '../models/Message.js';

const MESSAGE_URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
const TRAILING_URL_PUNCTUATION_REGEX = /[),.!?:;]+$/;
const MAX_HTML_BYTES = 220 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 4500;

const isLocalHostname = (hostname = '') => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  );
};

const isPrivateIp = (address = '') => {
  const family = net.isIP(address);
  if (!family) return true;

  if (family === 4) {
    const [a, b] = address.split('.').map(Number);

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  const lowerAddress = address.toLowerCase();
  return (
    lowerAddress === '::1' ||
    lowerAddress === '::' ||
    lowerAddress.startsWith('fc') ||
    lowerAddress.startsWith('fd') ||
    lowerAddress.startsWith('fe80:') ||
    lowerAddress.startsWith('::ffff:127.') ||
    lowerAddress.startsWith('::ffff:10.') ||
    lowerAddress.startsWith('::ffff:192.168.')
  );
};

const decodeHtmlEntities = (value = '') =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeUrl = (rawUrl = '') => {
  const withoutTrailingPunctuation = rawUrl.trim().replace(TRAILING_URL_PUNCTUATION_REGEX, '');
  return /^https?:\/\//i.test(withoutTrailingPunctuation)
    ? withoutTrailingPunctuation
    : `https://${withoutTrailingPunctuation}`;
};

export const extractFirstUrl = (content = '') => {
  const match = content.match(MESSAGE_URL_REGEX);
  return match ? normalizeUrl(match[0]) : null;
};

const assertPublicHttpUrl = async (rawUrl) => {
  const url = new URL(rawUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Unsupported preview protocol');
  }

  if (isLocalHostname(url.hostname)) {
    throw new Error('Local preview hostname is blocked');
  }

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error('Private preview address is blocked');
  }

  return url;
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const readLimitedText = async (response) => {
  const reader = response.body?.getReader?.();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let html = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_HTML_BYTES) {
      throw new Error('Preview HTML is too large');
    }

    html += decoder.decode(value, { stream: true });
  }

  return html + decoder.decode();
};

const fetchHtml = async (rawUrl, redirectCount = 0) => {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('Too many preview redirects');
  }

  const url = await assertPublicHttpUrl(rawUrl);
  const response = await fetchWithTimeout(url.toString(), {
    redirect: 'manual',
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'PingMeBot/1.0 (+https://pingme.local)',
    },
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) return null;
    return fetchHtml(new URL(location, url).toString(), redirectCount + 1);
  }

  if (!response.ok) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) return null;

  return {
    finalUrl: url.toString(),
    html: await readLimitedText(response),
  };
};

const getAttribute = (tag, attributeName) => {
  const match = tag.match(new RegExp(`${attributeName}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeHtmlEntities(match[1]) : '';
};

const findMetaContent = (html, keys) => {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) || [];
  const normalizedKeys = keys.map((key) => key.toLowerCase());

  for (const tag of metaTags) {
    const name = getAttribute(tag, 'name').toLowerCase();
    const property = getAttribute(tag, 'property').toLowerCase();

    if (normalizedKeys.includes(name) || normalizedKeys.includes(property)) {
      const content = getAttribute(tag, 'content');
      if (content) return content;
    }
  }

  return '';
};

const findTitle = (html) => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '')) : '';
};

const normalizePreviewImage = (imageUrl, baseUrl) => {
  if (!imageUrl) return '';

  try {
    const url = new URL(imageUrl, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (isLocalHostname(url.hostname)) return '';
    return url.toString();
  } catch {
    return '';
  }
};

const parsePreview = ({ finalUrl, html }) => {
  const url = new URL(finalUrl);
  const title =
    findMetaContent(html, ['og:title', 'twitter:title']) ||
    findTitle(html) ||
    url.hostname.replace(/^www\./, '');
  const description = findMetaContent(html, [
    'og:description',
    'twitter:description',
    'description',
  ]);
  const image = normalizePreviewImage(
    findMetaContent(html, ['og:image', 'twitter:image']),
    finalUrl,
  );
  const siteName = findMetaContent(html, ['og:site_name']) || url.hostname.replace(/^www\./, '');

  return {
    url: finalUrl,
    title: title.slice(0, 180),
    description: description.slice(0, 260),
    image,
    siteName: siteName.slice(0, 80),
    hostname: url.hostname.replace(/^www\./, ''),
  };
};

export const fetchLinkPreview = async (rawUrl) => {
  const result = await fetchHtml(rawUrl);
  if (!result) return null;

  const preview = parsePreview(result);
  if (!preview.title && !preview.description && !preview.image) return null;

  return preview;
};

export const updateMessageLinkPreview = async ({ messageId, contentSnapshot }) => {
  const firstUrl = extractFirstUrl(contentSnapshot);
  if (!firstUrl) return null;

  const linkPreview = await fetchLinkPreview(firstUrl);
  if (!linkPreview) return null;

  const updatedMessage = await Message.findOneAndUpdate(
    {
      _id: messageId,
      content: contentSnapshot,
      isDeleted: false,
    },
    { $set: { linkPreview } },
    { new: true },
  )
    .select('_id conversation linkPreview updatedAt')
    .lean();

  if (!updatedMessage?.linkPreview) return null;

  return {
    messageId: updatedMessage._id.toString(),
    conversationId: updatedMessage.conversation?.toString() || '',
    linkPreview: updatedMessage.linkPreview,
    updatedAt: updatedMessage.updatedAt,
  };
};
