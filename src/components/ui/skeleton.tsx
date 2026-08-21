import type { CSSProperties } from "react";

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "var(--radius-md)",
  className = "",
  style,
}: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="ui-skeleton-card" aria-hidden="true">
      <Skeleton height="24px" width="40%" />
      <Skeleton height="16px" width="70%" />
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <Skeleton height="40px" width="50%" />
        <Skeleton height="40px" width="50%" />
      </div>
    </div>
  );
}
