import { type ReactNode, type CSSProperties } from "react";
import "./StarBorder.css";

export interface StarBorderProps {
  className?: string;
  color?: string;
  speed?: string;
  delay?: string;
  thickness?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

const StarBorder = ({
  className = "",
  color = "white",
  speed = "6s",
  delay = "0s",
  thickness = 1,
  children,
  style,
}: StarBorderProps) => {
  return (
    <div className={`star-border-container ${className}`} style={{ padding: `${thickness}px 0`, ...style }}>
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
          animationDelay: delay,
        }}
      />
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
          animationDelay: delay,
        }}
      />
      <div className="inner-content">{children}</div>
    </div>
  );
};

export default StarBorder;
