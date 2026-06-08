import Message from '../models/Message.js';
import { getHttpPreviewClient } from '../integrations/http/httpPreviewClientFactory.js';

const MESSAGE_URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
const TRAILING_URL_PUNCTUATION_REGEX = /[),.!?:;]+$/;

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
  const result = await getHttpPreviewClient().fetchHtml(rawUrl);
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
