// Original inline-SVG illustration for the Login / Signup screens: a woman at a laptop inside a nest of branches,
// a friendly AI robot, four floating cards and a handwritten tagline. No external assets. Colours that must follow
// the theme use Tailwind classes backed by the semantic tokens (fill-ink, fill-accent ...) or an explicit
// `dark:` variant; the botanical greens are fixed because they read well on both the light and the dark mint panel.

const CARD = 'fill-white dark:fill-[#123A34] stroke-sage/60 dark:stroke-sage/40';
const HAND = '"Segoe Script", "Bradley Hand", "Lucida Handwriting", "Brush Script MT", cursive';

function Leaf({ x, y, r = 0, s = 1, fill = '#6FA183' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0C-9 -12 -8 -30 0 -42C8 -30 9 -12 0 0Z" fill={fill} />
      <path d="M0 -2V-34" stroke="#235347" strokeOpacity=".45" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function FloatCard({ x, y, w, h, children }) {
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#auth-card-shadow)">
      <rect width={w} height={h} rx="14" className={CARD} strokeWidth="1" />
      {children}
    </g>
  );
}

function Nest() {
  const branch = (d, c, w = 5) => <path d={d} stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />;
  return (
    <g>
      <ellipse cx="280" cy="398" rx="178" ry="34" fill="#163832" opacity=".55" />
      {branch('M95 398C130 450 430 450 468 396', '#2F6B5B', 7)}
      {branch('M90 388C140 440 420 440 472 388', '#5C8A6A', 5)}
      {branch('M110 372C160 424 400 428 456 372', '#8EB69B', 4)}
      {branch('M100 405C150 458 410 460 462 404', '#163832', 5)}
      {branch('M130 350C190 400 370 404 436 352', '#5C8A6A', 4)}
      {branch('M85 392C120 372 160 366 200 372', '#8EB69B', 4)}
      {branch('M475 392C440 372 396 366 360 372', '#8EB69B', 4)}
      {branch('M140 420C200 448 360 450 420 420', '#8EB69B', 3)}
      {branch('M96 376C150 336 230 352 290 372C340 388 420 372 470 352', '#2F6B5B', 5)}
      {branch('M84 404C170 352 260 392 340 378C400 368 450 380 482 396', '#8EB69B', 3)}
      {branch('M110 360C190 392 300 340 440 368', '#163832', 4)}
      {branch('M128 428C220 392 320 440 436 412', '#5C8A6A', 4)}
      {branch('M92 384C150 414 230 360 300 396C350 420 430 396 478 380', '#2F6B5B', 3)}
      {branch('M150 372C170 346 196 344 214 356M356 356C376 340 408 342 426 360', '#8EB69B', 3)}
      {branch('M72 372C60 350 62 326 78 308', '#5C8A6A', 3)}
      {branch('M488 372C500 350 498 326 482 308', '#5C8A6A', 3)}
      <Leaf x={78} y={310} r={-25} s={1.1} />
      <Leaf x={92} y={338} r={-70} s={0.9} fill="#8EB69B" />
      <Leaf x={60} y={346} r={-40} s={0.8} fill="#5C8A6A" />
      <Leaf x={482} y={310} r={25} s={1.1} />
      <Leaf x={468} y={338} r={70} s={0.9} fill="#8EB69B" />
      <Leaf x={500} y={346} r={40} s={0.8} fill="#5C8A6A" />
      <Leaf x={120} y={392} r={-100} s={0.7} fill="#8EB69B" />
      <Leaf x={440} y={392} r={100} s={0.7} fill="#8EB69B" />
    </g>
  );
}

function Woman() {
  const skin = '#F1D2BA';
  const hair = '#0B2B26';
  return (
    <g>
      {/* back hair */}
      <path d="M214 150C198 84 340 78 330 158C346 224 352 268 340 306L206 306C194 262 204 200 214 150Z" fill={hair} className="dark:stroke-[#2C5E52]" strokeWidth="1.5" />
      {/* neck */}
      <path d="M257 200h24v34a12 12 0 0 1-24 0Z" fill="#E4BFA3" />
      {/* torso */}
      <path d="M186 348C190 274 232 236 268 236C306 236 342 268 348 348Z" fill="#6FA183" />
      <path d="M246 236c6 14 30 14 36 0" stroke="#4E8466" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* arm to chin */}
      <path d="M330 312C356 270 338 226 306 204" stroke="#6FA183" strokeWidth="26" strokeLinecap="round" fill="none" />
      <circle cx="303" cy="198" r="11" fill={skin} />
      <path d="M296 192c-2-6 2-9 6-8" stroke="#E4BFA3" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* head */}
      <ellipse cx="268" cy="162" rx="40" ry="48" fill={skin} />
      {/* fringe */}
      <path d="M226 164C220 108 264 98 288 112C308 126 314 148 312 170C298 142 270 128 240 142C232 148 228 156 226 164Z" fill={hair} className="dark:stroke-[#2C5E52]" strokeWidth="1.5" />
      <path d="M228 170C224 190 228 206 236 216C230 196 232 182 234 172Z" fill={hair} />
      {/* face */}
      <circle cx="254" cy="166" r="3.2" fill="#0B2B26" />
      <circle cx="284" cy="166" r="3.2" fill="#0B2B26" />
      <path d="M247 156q7-5 14-1M277 155q7-4 14 1" stroke="#0B2B26" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M259 186q10 9 21 0" stroke="#B5645A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="246" cy="178" rx="6" ry="3.6" fill="#F4A9A0" opacity=".45" />
      <ellipse cx="292" cy="178" rx="6" ry="3.6" fill="#F4A9A0" opacity=".45" />
      {/* laptop (back of the lid faces us) */}
      <path d="M224 350L240 286H346L356 350Z" fill="#3B6B5A" />
      <path d="M224 350L240 286H346L356 350Z" fill="none" stroke="#163832" strokeOpacity=".5" strokeWidth="2" />
      <g transform="translate(293 322) scale(.9)">
        <path d="M0 14V0" stroke="#DAF1DE" strokeWidth="2" strokeLinecap="round" />
        <path d="M0 2C0-8-7-14-16-14c0 10 6 16 16 16Z" fill="#DAF1DE" opacity=".9" />
        <path d="M0 0C0-9 6-14 15-14 0 .5 0 0 0 0Z" fill="#8EB69B" />
        <path d="M0 0C0 -8 6 -14 15 -14C15 -5 9 1 0 0Z" fill="#8EB69B" />
      </g>
      <path d="M200 350H378L392 362H188Z" fill="#2A5446" />
      <path d="M200 350H378" stroke="#8EB69B" strokeOpacity=".5" strokeWidth="1.5" />
      {/* hand on laptop */}
      <ellipse cx="232" cy="344" rx="14" ry="8" fill={skin} />
    </g>
  );
}

function Robot() {
  return (
    <g transform="translate(446 206)">
      <path d="M0-36V-46" stroke="#163832" strokeWidth="3" strokeLinecap="round" className="dark:stroke-[#8EB69B]" />
      <circle cy="-49" r="5" fill="#8EB69B" />
      <rect x="-34" y="-34" width="68" height="58" rx="26" fill="#F4FAF5" stroke="#163832" strokeWidth="2.5" className="dark:fill-[#DAF1DE]" />
      <rect x="-26" y="-24" width="52" height="38" rx="18" fill="#0B2B26" />
      <circle cx="-9" cy="-6" r="4.6" fill="#DAF1DE" />
      <circle cx="9" cy="-6" r="4.6" fill="#DAF1DE" />
      <path d="M-7 4q7 6 14 0" stroke="#8EB69B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="-42" y="-14" width="9" height="22" rx="4.5" fill="#235347" />
      <rect x="33" y="-14" width="9" height="22" rx="4.5" fill="#235347" />
      <path d="M-62-24l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#235347" className="dark:fill-[#8EB69B]" />
      <path d="M60-10l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4Z" fill="#235347" className="dark:fill-[#8EB69B]" />
      <path d="M-30 34q4 10 12 10" stroke="#8EB69B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

export default function AuthIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 560 560"
      className={className}
      role="img"
      aria-label="Illustration: a woman working on a laptop inside a nest, with an AI assistant and cards showing a resume score, job matches, skills and interview prep."
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="auth-card-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#0B2B26" floodOpacity=".16" />
        </filter>
      </defs>

      {/* soft halo and orbit */}
      <circle cx="280" cy="270" r="215" className="fill-sage/20" />
      <path d="M130 250C112 190 150 118 230 100C290 88 330 90 372 112C430 138 470 190 488 250" fill="none" className="stroke-sage" strokeOpacity=".8" strokeWidth="1.6" strokeDasharray="1 0" />
      <circle cx="262" cy="92" r="6" className="fill-white dark:fill-[#123A34] stroke-sage" strokeWidth="1.5" />
      <Leaf x={226} y={78} r={-30} s={0.55} />
      <Leaf x={500} y={226} r={32} s={0.6} />

      <Woman />
      <Nest />

      <Robot />

      {/* Resume Score */}
      <FloatCard x={40} y={34} w={152} h={92}>
        <rect x="14" y="18" width="22" height="30" rx="4" fill="none" className="stroke-accent" strokeWidth="1.8" />
        <path d="M19 28h12M19 34h12M19 40h8" className="stroke-accent" strokeWidth="1.6" strokeLinecap="round" />
        <text x="46" y="28" fontSize="11" fontWeight="700" className="fill-ink" fontFamily="system-ui, sans-serif">Resume Score</text>
        <circle cx="62" cy="62" r="14" fill="none" className="stroke-sage/50" strokeWidth="3.5" />
        <circle cx="62" cy="62" r="14" fill="none" className="stroke-accent" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="81 88" transform="rotate(-90 62 62)" />
        <text x="62" y="66.5" fontSize="12.5" fontWeight="700" textAnchor="middle" className="fill-ink" fontFamily="system-ui, sans-serif">92</text>
        <rect x="86" y="55" width="54" height="6" rx="3" className="fill-sage/40" />
        <rect x="86" y="55" width="38" height="6" rx="3" className="fill-accent" />
        <rect x="86" y="68" width="30" height="5" rx="2.5" className="fill-sage/30" />
      </FloatCard>

      {/* Job Matches */}
      <FloatCard x={8} y={168} w={146} h={70}>
        <rect x="14" y="22" width="26" height="22" rx="4" fill="none" className="stroke-accent" strokeWidth="1.8" />
        <path d="M22 22v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M14 31h26" fill="none" className="stroke-accent" strokeWidth="1.8" strokeLinecap="round" />
        <text x="50" y="28" fontSize="11" fontWeight="700" className="fill-ink" fontFamily="system-ui, sans-serif">Job Matches</text>
        <text x="50" y="50" fontSize="15" className="fill-ink" fontFamily="system-ui, sans-serif">12 new</text>
        <path d="m124 30 6 6-6 6" fill="none" className="stroke-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </FloatCard>

      {/* Skills */}
      <FloatCard x={350} y={62} w={172} h={72}>
        <path d="M28 54V34" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 38C28 28 20 24 14 24c0 10 5 15 14 14Z" className="fill-accent" />
        <path d="M28 34c0-9 6-13 13-13 0 9-5 14-13 13Z" fill="#8EB69B" />
        <text x="54" y="30" fontSize="11" fontWeight="700" className="fill-ink" fontFamily="system-ui, sans-serif">Skills</text>
        <text x="54" y="50" fontSize="9.5" className="fill-accent" fontFamily="system-ui, sans-serif">Grow · Learn · Improve</text>
        <path d="m156 30 5 5-5 5" fill="none" className="stroke-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </FloatCard>

      {/* Interview Prep */}
      <FloatCard x={376} y={250} w={176} h={72}>
        <rect x="14" y="20" width="24" height="26" rx="4" fill="none" className="stroke-accent" strokeWidth="1.8" />
        <path d="M14 29h24M21 16v6M31 16v6" className="stroke-accent" strokeWidth="1.8" strokeLinecap="round" />
        <text x="50" y="30" fontSize="11" fontWeight="700" className="fill-ink" fontFamily="system-ui, sans-serif">Interview Prep</text>
        <text x="50" y="50" fontSize="9.5" className="fill-accent" fontFamily="system-ui, sans-serif">Practice · Build · Ace</text>
        <path d="m158 30 5 5-5 5" fill="none" className="stroke-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </FloatCard>

      {/* tagline */}
      <text x="280" y="512" textAnchor="middle" fontSize="15.5" className="fill-primary" style={{ fontFamily: HAND, fontStyle: 'italic' }}>
        Better Skills  →  Better Opportunities  →  A Brighter Future
      </text>
      <path d="M200 534h66M294 534h66" className="stroke-accent" strokeOpacity=".7" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M280 539c-7-5-10-8-10-11a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 3-3 6-10 11Z" className="fill-none stroke-accent" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
