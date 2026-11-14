import { useId } from "react";

const svgProps = { className: "ill", viewBox: "0 0 120 100", "aria-hidden": true } as const;

function useUid() {
  return useId().replace(/:/g, "");
}

export function CoursesIllustration() {
  return (
    <svg {...svgProps}>
      <g transform="rotate(-12 44 60)">
        <rect x="24" y="24" width="44" height="58" rx="7" fill="var(--teal)" opacity=".85" />
      </g>
      <g transform="rotate(9 76 60)">
        <rect x="54" y="22" width="44" height="58" rx="7" fill="var(--amber)" opacity=".9" />
      </g>
      <rect x="38" y="18" width="46" height="62" rx="7" fill="var(--violet)" />
      <rect x="46" y="30" width="26" height="4" rx="2" fill="#fff" opacity=".9" />
      <rect x="46" y="38" width="18" height="4" rx="2" fill="#fff" opacity=".55" />
      <circle cx="74" cy="68" r="5" fill="none" stroke="#fff" strokeWidth="1.6" opacity=".8" />
    </svg>
  );
}

export function GradesIllustration() {
  return (
    <svg {...svgProps}>
      <rect x="18" y="20" width="76" height="62" rx="9" fill="var(--i-card)" />
      <rect x="28" y="30" width="30" height="4" rx="2" fill="var(--i-line)" />
      <rect x="30" y="56" width="8" height="16" rx="2.5" fill="var(--i-line)" />
      <rect x="43" y="50" width="8" height="22" rx="2.5" fill="var(--i-line)" />
      <rect x="56" y="45" width="8" height="27" rx="2.5" fill="var(--i-line)" />
      <rect x="69" y="40" width="8" height="32" rx="2.5" fill="var(--green)" />
      <circle cx="94" cy="24" r="14" fill="var(--green)" />
      <text x="94" y="29.5" textAnchor="middle" fontFamily="Onest,sans-serif" fontWeight="600" fontSize="15" fill="#fff">
        8
      </text>
    </svg>
  );
}

export function CertificatesIllustration() {
  return (
    <svg {...svgProps}>
      <rect x="40" y="16" width="46" height="62" rx="7" fill="var(--i-card-2)" transform="rotate(6 63 47)" />
      <rect x="32" y="20" width="46" height="62" rx="7" fill="var(--i-card)" />
      <rect x="40" y="30" width="24" height="4" rx="2" fill="var(--i-line)" />
      <rect x="40" y="38" width="30" height="3" rx="1.5" fill="var(--i-line)" />
      <rect x="40" y="44" width="26" height="3" rx="1.5" fill="var(--i-line)" />
      <g fill="var(--i-line)">
        <rect x="54" y="58" width="5" height="5" rx="1" />
        <rect x="61" y="58" width="5" height="5" rx="1" />
        <rect x="61" y="65" width="5" height="5" rx="1" />
        <rect x="54" y="65" width="5" height="5" rx="1" opacity=".5" />
        <rect x="68" y="58" width="3" height="12" rx="1" opacity=".5" />
      </g>
      <circle cx="80" cy="74" r="13" fill="var(--sky)" />
      <path d="M74.5 74.2l3.8 3.8 7-7.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StudentCardIllustration() {
  const grad = `idg-${useUid()}`;
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9B9DFF" />
          <stop offset="1" stopColor="#4F51C9" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 60 50)">
        <rect x="14" y="26" width="92" height="56" rx="9" fill={`url(#${grad})`} />
        <circle cx="36" cy="50" r="10" fill="#fff" opacity=".9" />
        <rect x="26" y="64" width="20" height="4" rx="2" fill="#fff" opacity=".55" />
        <rect x="54" y="42" width="36" height="5" rx="2.5" fill="#fff" opacity=".9" />
        <rect x="54" y="52" width="26" height="4" rx="2" fill="#fff" opacity=".55" />
        <circle cx="92" cy="70" r="5" fill="none" stroke="#fff" strokeWidth="1.6" opacity=".85" />
        <circle cx="95.5" cy="66.5" r="1.6" fill="#fff" />
      </g>
    </svg>
  );
}

export function TeachersIllustration() {
  const uid = useUid();
  const [a1, a2, a3] = [`a1-${uid}`, `a2-${uid}`, `a3-${uid}`];
  const stops: [string, string, string][] = [
    [a1, "#E7CDB4", "#A88A70"],
    [a2, "#C9D3E6", "#7F8BA6"],
    [a3, "#D9C2E4", "#9878A8"],
  ];
  return (
    <svg {...svgProps}>
      <defs>
        {stops.map(([id, from, to]) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        ))}
      </defs>
      <circle cx="38" cy="52" r="17" fill={`url(#${a2})`} stroke="var(--s1)" strokeWidth="3" />
      <circle cx="82" cy="52" r="17" fill={`url(#${a3})`} stroke="var(--s1)" strokeWidth="3" />
      <circle cx="60" cy="48" r="20" fill={`url(#${a1})`} stroke="var(--s1)" strokeWidth="3" />
      <circle cx="84" cy="74" r="12" fill="var(--rose)" />
      <rect x="78" y="70" width="12" height="9" rx="1.8" fill="none" stroke="#fff" strokeWidth="1.7" />
      <path d="M78.5 71l5.5 4 5.5-4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryIllustration() {
  return (
    <svg {...svgProps}>
      <rect x="22" y="80" width="78" height="3" rx="1.5" fill="var(--i-line)" />
      <rect x="26" y="34" width="12" height="46" rx="3" fill="var(--amber)" />
      <rect x="40" y="26" width="14" height="54" rx="3" fill="var(--i-card-2)" />
      <rect x="44" y="34" width="6" height="3" rx="1.5" fill="var(--i-line)" />
      <rect x="56" y="38" width="10" height="42" rx="3" fill="var(--teal)" />
      <rect x="68" y="30" width="13" height="50" rx="3" fill="var(--lilac)" />
      <rect x="88" y="28" width="12" height="52" rx="3" fill="var(--sky)" transform="rotate(12 94 80)" />
    </svg>
  );
}
