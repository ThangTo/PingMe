const logoWebpSrc = '/brand/logo-trans.webp';
const logoPngSrc = '/brand/logo-trans.png';

const sizeClasses = {
  sm: 'h-8 w-8 rounded-[9px]',
  md: 'h-10 w-10 rounded-[12px]',
  lg: 'h-14 w-14 rounded-[16px]',
};

const PingMeLogo = ({ size = 'md', className = '', showShadow = false }) => (
  <picture>
    <source srcSet={logoWebpSrc} type="image/webp" />
    <img
      src={logoPngSrc}
      alt="PingMe"
      className={`${sizeClasses[size] || sizeClasses.md} shrink-0 object-cover ${
        showShadow ? 'shadow-sm' : ''
      } ${className}`}
      draggable="false"
      decoding="async"
    />
  </picture>
);

export default PingMeLogo;
