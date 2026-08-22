import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "arrow-left"
  | "book"
  | "calendar"
  | "chart"
  | "check"
  | "chevron-right"
  | "close"
  | "expense"
  | "info"
  | "image"
  | "microphone"
  | "pencil"
  | "plus"
  | "purchase"
  | "sale"
  | "stop"
  | "trash"
  | "trend-down"
  | "trend-up"
  | "user"
  | "x";

type Props = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export function UiIcon({ name, size = 20, strokeWidth = 1.9, ...props }: Props) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };

  return (
    <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 24 24" width={size} {...props}>
      {name === "alert" ? <><path {...common} d="m12 3 9 16H3L12 3Z" /><path {...common} d="M12 9v4" /><path {...common} d="M12 17h.01" /></> : null}
      {name === "arrow-left" ? <><path {...common} d="M19 12H5" /><path {...common} d="m11 18-6-6 6-6" /></> : null}
      {name === "book" ? <><path {...common} d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v17H7a2.5 2.5 0 0 0-2.5 2.5v-17Z" /><path {...common} d="M4.5 20A2.5 2.5 0 0 1 7 17.5h12.5" /></> : null}
      {name === "calendar" ? <><rect {...common} height="16" rx="2" width="17" x="3.5" y="4.5" /><path {...common} d="M8 2.5v4M16 2.5v4M3.5 9h17" /></> : null}
      {name === "chart" ? <><path {...common} d="M4 19.5h16" /><path {...common} d="M5.5 16 10 11.5l3.2 2.8L19 7" /><path {...common} d="M15.5 7H19v3.5" /></> : null}
      {name === "check" ? <path {...common} d="m5 12 4.2 4.2L19 6.5" /> : null}
      {name === "chevron-right" ? <path {...common} d="m9 18 6-6-6-6" /> : null}
      {name === "expense" ? <><circle {...common} cx="12" cy="12" r="8" /><path {...common} d="M8.5 12h7" /></> : null}
      {name === "info" ? <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="M12 10.5V16M12 8h.01" /></> : null}
      {name === "image" ? <><rect {...common} height="16" rx="2" width="18" x="3" y="4" /><circle {...common} cx="8.5" cy="9" r="1.5" /><path {...common} d="m4.5 17 5-5 3.5 3 2.5-2.5 4 4" /></> : null}
      {name === "microphone" ? <><rect {...common} height="11" rx="3" width="6" x="9" y="3" /><path {...common} d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M8.5 21h7" /></> : null}
      {name === "pencil" ? <><path {...common} d="m4 16.5-.5 4 4-.5L19 8.5 15.5 5 4 16.5Z" /><path {...common} d="m14.5 6 3.5 3.5" /></> : null}
      {name === "plus" ? <path {...common} d="M12 5v14M5 12h14" /> : null}
      {name === "purchase" ? <><path {...common} d="M12 4v14" /><path {...common} d="m7 13 5 5 5-5" /><path {...common} d="M5 21h14" /></> : null}
      {name === "sale" ? <><path {...common} d="M5 19 19 5" /><path {...common} d="M10 5h9v9" /></> : null}
      {name === "stop" ? <rect {...common} height="12" rx="1" width="12" x="6" y="6" /> : null}
      {name === "trash" ? <><path {...common} d="M5 7h14M9 7V4h6v3M7 7l.8 13h8.4L17 7M10 11v5M14 11v5" /></> : null}
      {name === "trend-down" ? <><path {...common} d="M5 7.5 10 12l3.2-3L19 15" /><path {...common} d="M15.5 15H19v-3.5" /></> : null}
      {name === "trend-up" ? <><path {...common} d="M5 16.5 10 12l3.2 3L19 9" /><path {...common} d="M15.5 9H19v3.5" /></> : null}
      {name === "user" ? <><path {...common} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle {...common} cx="12" cy="7" r="4" /></> : null}
      {name === "x" || name === "close" ? <path {...common} d="M18 6 6 18M6 6l12 12" /> : null}
    </svg>
  );
}
