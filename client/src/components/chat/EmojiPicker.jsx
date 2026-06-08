const EmojiPicker = ({ emojis = [], onSelect }) => {
  return (
    <div className="z-10 flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1.5 shadow-sm">
      {emojis.map((emoji) => (
        <button
          type="button"
          key={emoji}
          onClick={() => onSelect(emoji)}
          aria-label={`Thả cảm xúc ${emoji}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.98]"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;
