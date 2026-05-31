const EmojiPicker = ({ emojis = [], onSelect }) => {
  return (
    <div className="flex items-center gap-1 p-2 bg-surface-container-low border border-white/10 rounded-2xl shadow-xl z-10">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-lg transition-transform active:scale-110 hover:scale-110"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;
