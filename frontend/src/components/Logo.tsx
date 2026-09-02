import React from "react";
import Link from "next/link";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLAnchorElement, LogoProps>(({ isCollapsed }, ref) => {
  return (
    <Link href="/" ref={ref} aria-label="Go to Home">
      {isCollapsed ? (
        <span className="pulse-talq-mark pulse-talq-mark--compact">
          <span>p</span>
        </span>
      ) : (
        <span className="pulse-talq-mark">
          <span>pulse </span><strong>talq</strong>
        </span>
      )}
    </Link>
  );
});

Logo.displayName = "Logo";

export default Logo;
