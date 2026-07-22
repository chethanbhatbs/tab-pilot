import { useState } from 'react';
import { getFaviconUrl, getLetterAvatar, handleFaviconError } from '@/utils/grouping';

export function FaviconWithFallback({ url, favIconUrl, className = 'w-4 h-4 rounded-[3px] shrink-0' }) {
  const resolvedSrc = getFaviconUrl(url, favIconUrl);
  const [showLetter, setShowLetter] = useState(!resolvedSrc);

  if (showLetter) {
    const { letter, color } = getLetterAvatar(url);
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: '700',
          letterSpacing: '0.5px',
          color: color.fg,
          background: color.bg,
          borderRadius: '3px',
        }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt=""
      className={className}
      data-tab-url={url}
      data-chrome-favicon={favIconUrl || ''}
      onError={(e) => {
        handleFaviconError(e);
        // If the img is hidden by _showLetterAvatar, switch to React letter avatar
        if (e.target.style.display === 'none') {
          setShowLetter(true);
        }
      }}
    />
  );
}
