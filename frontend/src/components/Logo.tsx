"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

interface LogoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed, className = "", onClick, ...buttonProps }, ref) => {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <button
      ref={ref}
      {...buttonProps}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) router.push("/");
      }}
      aria-label="Home"
      aria-current={isHome ? "page" : undefined}
      className={`pulse-talq-mark ${isCollapsed ? "pulse-talq-mark--compact" : ""} ${isHome ? "bg-white/[0.09]" : ""} ${className}`}
    >
      {isCollapsed ? <span aria-hidden="true">p</span> : <><span>pulse </span><strong>talq</strong></>}
    </button>
  );
});

Logo.displayName = "Logo";

export default Logo;
