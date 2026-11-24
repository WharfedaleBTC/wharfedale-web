// Line icons, 24-unit grid, drawn in currentColor.
type P = { className?: string };
const svg = (className: string | undefined, d: React.ReactNode, w = 1.6) => (
  <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="square">
    {d}
  </svg>
);

export const ArrowRight = ({ className = 'button__icon button__icon--go' }: P) => svg(className, <path d="M4 12h15M13 6l6 6-6 6" />);
export const ArrowLeft = ({ className }: P) => svg(className, <path d="M20 12H5M11 6l-6 6 6 6" />, 1.8);
export const ArrowUpRight = ({ className = 'button__icon button__icon--up' }: P) => svg(className, <path d="M7 17 17 7M9 7h8v8" />);
export const ArrowDownLeft = ({ className = 'button__icon' }: P) => svg(className, <path d="M17 7 7 17M15 17H7V9" />);
export const Flow = ({ className = 'tx__arrow' }: P) => svg(className, <path d="M3 12h17M14 6l6 6-6 6" />, 1.2);

// Tile icons: geometric, isometric where it helps.
export const IconBlocks = ({ className = 'tile__icon' }: P) =>
  svg(className, <path d="M3 7.5 9 4l6 3.5L9 11zM3 7.5V14l6 3.5V11M15 7.5V14l-6 3.5M12 14.5l6-3.5 3 1.75v6.5L15 22.5l-3-1.75" />, 1.2);
export const IconWallet = ({ className = 'tile__icon' }: P) => svg(className, <path d="M3 6.5h16v13H3zM3 6.5 15 3v3.5M15 13h4M15 11v4" />, 1.2);
export const IconDrop = ({ className = 'tile__icon' }: P) => svg(className, <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9 15a3 3 0 0 0 3 3" />, 1.2);
export const IconAsset = ({ className = 'tile__icon' }: P) => svg(className, <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5" />, 1.2);
export const IconDocs = ({ className = 'tile__icon' }: P) => svg(className, <path d="M5 3h10l4 4v14H5zM15 3v4h4M8 11h8M8 14.5h8M8 18h5" />, 1.2);
