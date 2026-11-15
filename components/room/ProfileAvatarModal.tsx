"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CloseIcon } from "@/components/room/player/icons";
import { ProfileAvatarForm } from "@/components/ProfileAvatarForm";
import { iconButtonClass } from "@/components/ui/IconButton";
import { modalOverlayClass, modalPanelClass } from "@/components/ui/Modal";
import { sectionLabelClass } from "@/components/ui/SectionLabel";

export function ProfileAvatarModal({
  userId,
  avatarV,
  open,
  onClose,
}: {
  userId: string;
  avatarV: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    if (!triggerRef.current) return;
    triggerRef.current.focus();
    triggerRef.current = null;
  }, [open]);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={modalOverlayClass}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-avatar-modal-title"
        className={`${modalPanelClass} sm:max-w-sm`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="profile-avatar-modal-title" className={sectionLabelClass}>
            imagem de perfil
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            className={iconButtonClass({ variant: "ghost", surface: true })}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <ProfileAvatarForm userId={userId} initialAvatarV={avatarV} stacked />
      </div>
    </div>
  );
}
