export const getSafeRedirectPath = (value = '') => {
  if (typeof value !== 'string') return '';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '';
  return value;
};

export const getRedirectFromSearch = (search = '') => {
  const value = new URLSearchParams(search).get('redirect') || '';
  return getSafeRedirectPath(value);
};

export const withRedirectParam = (path, redirectPath = '') => {
  const safeRedirect = getSafeRedirectPath(redirectPath);
  if (!safeRedirect) return path;
  return `${path}?redirect=${encodeURIComponent(safeRedirect)}`;
};
