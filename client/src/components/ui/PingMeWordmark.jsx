import wordmarkSrc from '../../assets/images/pingme_trans.png';

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
    <img
      src={wordmarkSrc}
      alt=""
      className="h-full w-full object-cover object-[center_47%]"
      draggable="false"
    />
  </span>
);

export default PingMeWordmark;
