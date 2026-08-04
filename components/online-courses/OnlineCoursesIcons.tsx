// components/offline-courses/DeleteConfirmModal (bu yerda ham qayta
// ishlatiladi) ichida qattiq yozilgan `#i-trash` sprite havolasiga ega —
// global sprite'da yo'q, shuning uchun shu bitta symbol shu yerda ham mount
// qilinadi (path OfflineCoursesIcons.tsx bilan bir xil).
export default function OnlineCoursesIcons() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-trash" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></symbol>
      </defs>
    </svg>
  );
}
