import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = "",
  size = "md",
}) => {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-7 w-7 sm:h-8 sm:w-8",
    lg: "h-10 w-10 sm:h-12 sm:w-12",
  };

  return (
    <div
      className={`relative flex items-center justify-center rounded-lg bg-slate-900 border border-indigo-500/40 p-1 shadow-sm shadow-indigo-500/20 shrink-0 overflow-hidden ${sizeMap[size]} ${className}`}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-sky-500/20 to-purple-600/30 opacity-70" />

      {/* Vector Logo */}
      <svg
        viewBox="0 0 512 512"
        className="relative z-10 w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoPrimaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="logoAccentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* Analytics Bars */}
        <rect x="148" y="272" width="44" height="100" rx="12" fill="url(#logoAccentGrad)" />
        <rect x="214" y="196" width="44" height="176" rx="12" fill="url(#logoPrimaryGrad)" />
        <rect x="280" y="132" width="44" height="240" rx="12" fill="url(#logoPrimaryGrad)" />

        {/* Target Curve */}
        <path
          d="M 132 290 L 210 216 L 276 156 L 366 112"
          stroke="#38bdf8"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Target Node */}
        <circle cx="366" cy="112" r="26" fill="#38bdf8" />
        <circle cx="366" cy="112" r="12" fill="#ffffff" />
      </svg>
    </div>
  );
};
