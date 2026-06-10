const wordmarkWebpSrc = '/brand/pingme-wordmark.webp';
const wordmarkPngSrc = '/brand/pingme-wordmark.png';

const sizeClasses = {
  sm: 'h-8 w-[104px]',
  md: 'h-9 w-[124px]',
  lg: 'h-12 w-[166px]',
};

const PingMeWordmark = ({ size = 'md', className = '' }) => (
  <span
    className={`block shrink-0 overflow-hidden ${sizeClasses[size] || sizeClasses.md} ${className}`}
    aria-label="PingMe"
  >
    <picture className="block h-full w-full">
      <source srcSet={wordmarkWebpSrc} type="image/webp" />
      <img
        src={wordmarkPngSrc}
        alt=""
        className="h-full w-full object-cover object-[center_47%]"
        draggable="false"
        decoding="async"
      />
    </picture>
  </span>
);

export default PingMeWordmark;
