'use client';

/**
 * Convert a flag emoji (e.g. 🇸🇬) to a 2-letter ISO country code (e.g. "sg").
 * Flag emojis are composed of Regional Indicator Symbol Letters:
 * each letter is at codepoint 0x1F1E6 + (letter offset from A).
 */
function flagEmojiToCode(flag: string): string {
  const codePoints = [...flag].map((c) => c.codePointAt(0) || 0);
  // Filter only Regional Indicator codepoints (U+1F1E6 to U+1F1FF)
  const regional = codePoints.filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  if (regional.length !== 2) return '';
  const letters = regional.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 0x61));
  return letters.join('');
}

interface CountryFlagProps {
  flag: string; // emoji flag like 🇸🇬
  size?: number; // width in pixels (default 48)
  className?: string;
}

export default function CountryFlag({ flag, size = 48, className = '' }: CountryFlagProps) {
  const code = flagEmojiToCode(flag);

  if (!code) {
    // Fallback: render the emoji as-is
    return <span className={className}>{flag}</span>;
  }

  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={flag}
      width={size}
      height={Math.round(size * 0.75)}
      className={`inline-block rounded-sm ${className}`}
      style={{ width: size, height: 'auto' }}
      loading="lazy"
    />
  );
}
