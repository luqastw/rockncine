import type { ReactNode } from "react";

type IconProps = { className?: string };

function Glyph({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M9 5.5v21a1 1 0 0 0 1.5.86l17-10.5a1 1 0 0 0 0-1.72l-17-10.5A1 1 0 0 0 9 5.5Z" />
    </Glyph>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="7" y="6" width="7" height="20" rx="1" />
      <rect x="18" y="6" width="7" height="20" rx="1" />
    </Glyph>
  );
}

export function VolumeHighIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 12v8h5l7 5.5v-19L8 12H3Z" />
      <path d="M21.1 10.9A8 8 0 0 1 21.1 21.1L19 19.3A5.2 5.2 0 0 0 19 12.7Z" />
      <path d="M24.6 8A12.5 12.5 0 0 1 24.6 24L22.4 22.2A9.7 9.7 0 0 0 22.4 9.8Z" />
    </Glyph>
  );
}

export function VolumeMutedIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 12v8h5l7 5.5v-19L8 12H3Z" />
      <rect x="18.5" y="14.9" width="11" height="2.2" rx="1" transform="rotate(45 24 16)" />
      <rect x="18.5" y="14.9" width="11" height="2.2" rx="1" transform="rotate(-45 24 16)" />
    </Glyph>
  );
}

export function FullscreenEnterIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 5h8v3H8v5H5Z" />
      <path d="M27 5h-8v3h5v5h3Z" />
      <path d="M5 27h8v-3H8v-5H5Z" />
      <path d="M27 27h-8v-3h5v-5h3Z" />
    </Glyph>
  );
}

export function FullscreenExitIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M10 5h3v8H5v-3h5Z" />
      <path d="M22 5h-3v8h8v-3h-5Z" />
      <path d="M10 27h3v-8H5v3h5Z" />
      <path d="M22 27h-3v-8h8v3h-5Z" />
    </Glyph>
  );
}

export function TheaterIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path fillRule="evenodd" d="M4 6h24v20H4Zm3 3v14h13V9Zm15 0v14h3V9Z" />
    </Glyph>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="4" y="14.5" width="24" height="3" rx="1" transform="rotate(45 16 16)" />
      <rect x="4" y="14.5" width="24" height="3" rx="1" transform="rotate(-45 16 16)" />
    </Glyph>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M14 6h4v8h8v4h-8v8h-4v-8H6v-4h8Z" />
    </Glyph>
  );
}

export function CaptionsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        fillRule="evenodd"
        d="M5 6h22a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm2 5v3h8v-3Zm10 0v3h8v-3ZM7 17v3h6v-3Zm8 0v3h10v-3Z"
      />
    </Glyph>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 11l11 11 11-11-3-3-8 8-8-8Z" />
    </Glyph>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 14h16.2l-5.6-5.6L18 6l10 10-10 10-2.4-2.4 5.6-5.6H5Z" />
    </Glyph>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M27 14H10.8l5.6-5.6L14 6 4 16l10 10 2.4-2.4-5.6-5.6H27Z" />
    </Glyph>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M4 8h24v3H4Zm0 6.5h24v3H4Zm0 6.5h24v3H4Z" />
    </Glyph>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="16" cy="10" r="6" />
      <path d="M4 28c0-6.6 5.4-10 12-10s12 3.4 12 10Z" />
    </Glyph>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="11" r="5" />
      <path d="M2 27c0-5.5 4.4-8.5 10-8.5s10 3 10 8.5Z" />
      <circle cx="23" cy="12" r="4" />
      <path d="M24 18.6c4 .4 7 2.8 7 7.4h-6.4c0-3-.6-5.6-.6-7.4Z" />
    </Glyph>
  );
}

export function LeafIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M27 4C14 4 5 10 5 20c0 2.2.6 4 1.6 5.4L4 28l2.8 1 2-2.8c1.6 1 3.5 1.6 6.2 1.6C25 27.8 28 16 27 4Z" />
    </Glyph>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M12 3h8l1 3h6v3H5V6h6Zm-5 8h18l-1.2 16a2 2 0 0 1-2 1.9H10.2a2 2 0 0 1-2-1.9Z" />
    </Glyph>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="16" cy="6" r="3" />
      <circle cx="16" cy="16" r="3" />
      <circle cx="16" cy="26" r="3" />
    </Glyph>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 5h22a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H14l-6 5v-5H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </Glyph>
  );
}

export function ScreenIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path fillRule="evenodd" d="M3 5h26v18H3Zm3 3v12h20V8Z" />
      <path d="M13 23h6v3h4v3H9v-3h4Z" />
    </Glyph>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        fillRule="evenodd"
        d="M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26Zm-1.5 6v8.2l6.5 3.9 1.5-2.6-5-3V9Z"
      />
    </Glyph>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M10 3h15a2 2 0 0 1 2 2v17h-3V6H10Z" />
      <path d="M5 9h15a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z" />
    </Glyph>
  );
}

export function DiamondIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M16 3 29 16 16 29 3 16Z" />
    </Glyph>
  );
}

export function SmileIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        fillRule="evenodd"
        d="M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26Zm-5 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM9.5 19.5h13a6.5 6.5 0 0 1-13 0Z"
      />
    </Glyph>
  );
}
