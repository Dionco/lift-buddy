import { useRef, useEffect } from "react";
import { ActiveWorkout } from "./ActiveWorkout";

interface WorkoutSheetProps {
  open: boolean;
  onCollapse: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

export function WorkoutSheet({ open, onCollapse, onFinish, onCancel }: WorkoutSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // Lock scroll on <html> (not body) while sheet is open.
  // On iOS Safari, overflow:hidden on body breaks touch scroll inside fixed overlays.
  // Setting it on documentElement avoids that bug.
  useEffect(() => {
    const el = document.documentElement;
    if (open) {
      el.style.overflow = "hidden";
    } else {
      el.style.overflow = "";
    }
    return () => {
      el.style.overflow = "";
    };
  }, [open]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;

    const sheet = sheetRef.current;
    if (!sheet) return;

    const TRANSITION = "transform 0.32s cubic-bezier(0.4,0,0.2,1)";
    sheet.style.transition = TRANSITION;

    if (delta > 80) {
      sheet.style.transform = "translateY(100%)";
      sheet.addEventListener(
        "transitionend",
        () => {
          sheet.style.transition = "";
          sheet.style.transform = "";
          onCollapse();
        },
        { once: true },
      );
    } else {
      sheet.style.transform = "translateY(0)";
      sheet.addEventListener(
        "transitionend",
        () => {
          sheet.style.transition = "";
          sheet.style.transform = "";
        },
        { once: true },
      );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 59,
          background: "rgba(0,0,0,0.25)",
          pointerEvents: open ? "all" : "none",
          opacity: open ? 1 : 0,
          transition: "opacity 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Sheet — top+bottom instead of height so the browser computes a
           guaranteed finite pixel height in all browsers/iOS versions.
           This makes flex:1 children (and the scroll container) work correctly. */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed",
          top: "2vh",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          clipPath: "inset(0 0 0 0 round 16px 16px 0 0)",
        }}
      >
        {/* Drag handle bar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            background: "#FFFFFF",
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "#D3D1C7",
            }}
          />
        </div>

        {/* ActiveWorkout fills remaining height */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ActiveWorkout onFinish={onFinish} />
        </div>
      </div>
    </>
  );
}
