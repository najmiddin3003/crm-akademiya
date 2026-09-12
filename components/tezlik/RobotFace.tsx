// Ko'k robot yuzi — suzuvchi tugma ikonkasi (referens: akademiya.edutizim.uz
// sidebar'idagi robot). Oddiy SVG: antenna, ikki quloq, yumaloq bosh, ikki
// oq ko'z (ko'k qorachiq) va tabassum. Rang butun ilovada bir xil ko'k —
// brendga bog'lanmagan, chunki referensdagi robot ham ko'k.
export default function RobotFace({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <line x1="32" y1="8" x2="32" y2="16" stroke="#2F6BFF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="3.5" fill="#2F6BFF" />
      <rect x="4" y="28" width="6" height="14" rx="3" fill="#2F6BFF" />
      <rect x="54" y="28" width="6" height="14" rx="3" fill="#2F6BFF" />
      <rect x="11" y="16" width="42" height="38" rx="13" fill="#2F6BFF" />
      <rect x="16" y="22" width="32" height="24" rx="9" fill="#1F4FD1" />
      <circle cx="25" cy="33" r="6" fill="#fff" />
      <circle cx="39" cy="33" r="6" fill="#fff" />
      <circle cx="26" cy="34" r="2.6" fill="#1F4FD1" />
      <circle cx="40" cy="34" r="2.6" fill="#1F4FD1" />
      <path d="M25 42 Q32 47 39 42" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
