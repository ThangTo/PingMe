const EmojiPicker = ({ emojis = [], onSelect }) => {
  return (
    <div className="z-10 flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-surface-container-low active:scale-[0.98]"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;
