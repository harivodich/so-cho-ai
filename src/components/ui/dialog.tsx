"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { UiIcon } from "@/components/ui-icon";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
};

export function AccessibleDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "540px",
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      previousActiveElement.current?.focus?.();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="accessible-modal-dialog"
      style={{ maxWidth }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-desc" : undefined}
    >
      <div className="accessible-modal-content">
        <div className="accessible-modal-header">
          <div>
            <h2 id="dialog-title" className="accessible-modal-title">{title}</h2>
            {description ? <p id="dialog-desc" className="accessible-modal-desc">{description}</p> : null}
          </div>
          <button
            type="button"
            className="accessible-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <UiIcon name="trash" size={16} />
          </button>
        </div>
        <div className="accessible-modal-body">{children}</div>
      </div>
    </dialog>
  );
}
