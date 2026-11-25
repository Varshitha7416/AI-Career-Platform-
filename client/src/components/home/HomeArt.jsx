// Original inline-SVG illustrations for the Home page (no external images). Everything here is decoration:
// the "85%" ring in the resume scene is a drawing, not a real score. Greens are fixed palette values that read on
// both the light and the dark mint panels; paper surfaces follow the theme through classes.

const PAPER = 'fill-white dark:fill-[#123A34] stroke-sage/60 dark:stroke-sage/40';
const HAND = '"Segoe Script", "Bradley Hand", "Lucida Handwriting", "Brush Script MT", cursive';
const SKIN = '#E4B08A';
const HAIR = '#1E2B25';

function Leaf({ x, y, r = 0, s = 1, fill = '#6FA183' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0C-9 -12 -8 -30 0 -42C8 -30 9 -12 0 0Z" fill={fill} />
      <path d="M0 -2V-34" stroke="#235347" strokeOpacity=".45" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function Plant({ x, y, s = 1, flip = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Leaf x={0} y={0} r={-28} s={1.3} fill="#5C8A6A" />
      <Leaf x={0} y={0} r={-4} s={1.5} fill="#6FA183" />
      <Leaf x={0} y={0} r={24} s={1.25} fill="#8EB69B" />
      <Leaf x={0} y={0} r={48} s={0.95} fill="#5C8A6A" />
    </g>
  );
}

function Cloud({ x, y, s = 1 }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 16c-8 0-12-10-3-14 2-9 16-10 20-1 9-3 15 8 7 15Z" fill="#8EB69B" opacity=".35" />;
}

// Woman with long dark hair, resting her chin on her hand, at a laptop. Origin = her desk line.
function Woman({ x = 0, y = 0, s = 1, typing = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* hair back */}
      <path d="M-46 -150c-6-34 14-56 46-56s52 22 46 56c-3 22 2 50 14 70-30 6-62 6-80 0 4-12-2-22-8-34-8-10-16-20-18-36Z" fill={HAIR} />
      {/* torso */}
      <path d="M-72 0c2-46 24-72 72-72s70 26 72 72Z" fill="#7FA68A" />
      <path d="M-22 -72c6 10 38 10 44 0l-4 14c-12 8-28 8-36 0Z" fill="#6A9378" />
      {/* neck + face */}
      <rect x="-12" y="-96" width="24" height="30" rx="10" fill={SKIN} />
      <ellipse cx="0" cy="-130" rx="34" ry="38" fill={SKIN} />
      {/* fringe */}
      <path d="M-36 -134c2-26 20-40 38-40 20 0 34 16 34 42-10-8-22-22-30-30-6 14-24 26-42 28Z" fill={HAIR} />
      {/* face */}
      <circle cx="-12" cy="-128" r="2.6" fill={HAIR} />
      <circle cx="14" cy="-128" r="2.6" fill={HAIR} />
      <path d="M-9 -112c5 5 13 5 18 0" stroke="#A4573F" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="-22" cy="-118" r="5" fill="#E88F7A" opacity=".45" />
      <circle cx="24" cy="-118" r="5" fill="#E88F7A" opacity=".45" />
      {/* arm */}
      {typing ? (
        <>
          <path d="M-58 -52c-10 22-12 40-4 52h34c4-12 4-30 0-42Z" fill="#6A9378" />
          <path d="M58 -52c10 22 12 40 4 52H28c-4-12-4-30 0-42Z" fill="#6A9378" />
        </>
      ) : (
        <>
          <path d="M44 -50c18 4 22 22 12 34l-26 6c-8-6-10-20-6-30Z" fill="#6A9378" />
          <path d="M30 -92c-12 2-20 12-16 26l14 6c8-4 10-16 4-26Z" fill={SKIN} />
          <path d="M56 -16 30 -10l4 14 26-6Z" fill="#6A9378" />
        </>
      )}
    </g>
  );
}

function Laptop({ x, y, s = 1, w = 150 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={`M${-w / 2} 0h${w}l-8-84h${-(w - 16)}Z`} fill="#2F5A4B" />
      <path d={`M${-w / 2 + 6} -4h${w - 12}l-6.5-76h${-(w - 25)}Z`} fill="#3D7260" opacity=".55" />
      <g transform="translate(0 -44)">
        <path d="M0 14c-14-4-14-24 0-30 14 6 14 26 0 30Z" fill="#DAF1DE" />
        <path d="M0 14V-12" stroke="#2F5A4B" strokeWidth="2" strokeLinecap="round" />
      </g>
      <rect x={-w / 2 - 8} y="0" width={w + 16} height="9" rx="4.5" fill="#235347" />
    </g>
  );
}

function Robot({ x = 0, y = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* sprout */}
      <path d="M0 -62v-14" stroke="#5C8A6A" strokeWidth="3" strokeLinecap="round" />
      <path d="M0 -76c-12-2-18-10-18-18 12 0 18 6 18 18Z" fill="#6FA183" />
      <path d="M0 -76c12-2 18-10 18-18-12 0-18 6-18 18Z" fill="#8EB69B" />
      {/* head */}
      <rect x="-34" y="-64" width="68" height="52" rx="24" fill="#F3FAF5" stroke="#8EB69B" strokeWidth="2" />
      <rect x="-25" y="-56" width="50" height="34" rx="16" fill="#0B2B26" />
      <circle cx="-9" cy="-40" r="4.6" fill="#DAF1DE" />
      <circle cx="9" cy="-40" r="4.6" fill="#DAF1DE" />
      <path d="M-5 -31c3 3 7 3 10 0" stroke="#DAF1DE" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* body */}
      <path d="M-26 -8c0 26 6 44 26 44s26-18 26-44Z" fill="#F3FAF5" stroke="#8EB69B" strokeWidth="2" />
      <path d="M-26 6c-14 4-20 14-18 24M26 6c14-6 20-18 14-30" stroke="#8EB69B" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M-8 12c4 4 12 4 16 0" stroke="#8EB69B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </g>
  );
}

function DocCard({ x, y, r = 0, w = 70, h = 92, tone = '#8EB69B' }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect width={w} height={h} rx="10" className={PAPER} strokeWidth="1.2" />
      <circle cx={w / 2} cy="22" r="11" fill={tone} opacity=".45" />
      <path d={`M${w / 2 - 5} 22l3.6 3.6 6.4-7`} stroke="#235347" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="12" y="44" width={w - 24} height="5" rx="2.5" fill={tone} opacity=".6" />
      <rect x="12" y="56" width={w - 34} height="5" rx="2.5" fill={tone} opacity=".4" />
      <rect x="12" y="68" width={w - 28} height="5" rx="2.5" fill={tone} opacity=".4" />
    </g>
  );
}

function Mug({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 -30h30v20c0 8-6 12-15 12S0 -2 0 -10Z" fill="#F3FAF5" stroke="#8EB69B" strokeWidth="2" />
      <path d="M30 -24c10 0 10 14 0 14" stroke="#8EB69B" strokeWidth="2.4" fill="none" />
      <path d="M15 -9c-6-5-5-9 0-9 5 0 6 4 0 9Z" fill="#E88F7A" />
    </g>
  );
}

function Books({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="-16" width="74" height="16" rx="3" fill="#2F5A4B" />
      <rect x="6" y="-32" width="66" height="16" rx="3" fill="#8EB69B" />
      <rect x="2" y="-48" width="62" height="16" rx="3" fill="#5C8A6A" />
      <path d="M8 -8h58M14 -24h46M10 -40h40" stroke="#DAF1DE" strokeWidth="1.6" opacity=".7" />
    </g>
  );
}

function Pot({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-18 0h36l-4 26h-28Z" fill="#8A6D58" />
      <Leaf x={0} y={0} r={-30} s={1.1} fill="#5C8A6A" />
      <Leaf x={0} y={0} r={0} s={1.4} fill="#6FA183" />
      <Leaf x={0} y={0} r={30} s={1.1} fill="#8EB69B" />
    </g>
  );
}

// ---------------------------------------------------------------- hero (woman + robot + floating cards)
export function HeroScene({ className = '' }) {
  return (
    <svg viewBox="0 0 520 380" className={className} role="img" aria-label="Illustration of a woman working on a laptop beside a friendly robot holding a sprout">
      <defs>
        <filter id="home-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#0B2B26" floodOpacity=".16" />
        </filter>
      </defs>
      <circle cx="270" cy="170" r="150" fill="#8EB69B" opacity=".22" />
      <Cloud x="60" y="50" s={1.2} />
      <Cloud x="400" y="30" s={0.9} />
      <g filter="url(#home-shadow)">
        <DocCard x={60} y={34} r={-9} w={86} h={108} />
        <DocCard x={150} y={14} r={-4} w={84} h={108} tone="#6FA183" />
        <g transform="translate(372 54) rotate(7)">
          <rect width="96" height="62" rx="10" className={PAPER} strokeWidth="1.2" />
          <circle cx="22" cy="22" r="11" fill="#8EB69B" opacity=".5" />
          <rect x="40" y="16" width="44" height="5" rx="2.5" fill="#8EB69B" opacity=".6" />
          <rect x="40" y="28" width="34" height="5" rx="2.5" fill="#8EB69B" opacity=".4" />
          <rect x="12" y="44" width="72" height="5" rx="2.5" fill="#8EB69B" opacity=".35" />
        </g>
      </g>
      <text x="408" y="30" fontFamily={HAND} fontSize="18" fill="#5C8A6A" textAnchor="middle" transform="rotate(-8 408 30)">Dream · Plan · Achieve</text>
      {/* desk + plants */}
      <Plant x={40} y={338} s={1.3} />
      <Plant x={82} y={338} s={0.9} flip />
      <Plant x={488} y={330} s={1.4} flip />
      <Pot x={448} y={286} />
      <path d="M18 338H506" stroke="#235347" strokeWidth="3" strokeLinecap="round" />
      <Woman x={240} y={338} s={1.0} />
      <Laptop x={282} y={338} s={1} w={160} />
      <Mug x={118} y={338} />
      <Books x={398} y={338} />
      <Robot x={372} y={216} s={0.95} />
      <g fill="#E88F7A">
        <path d="M418 130c-6-5-14 0-9 7l9 9 9-9c5-7-3-12-9-7Z" transform="translate(-10 4) scale(.8)" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- "Why CareerNest" scene
export function WhyScene({ className = '' }) {
  return (
    <svg viewBox="0 0 420 300" className={className} role="img" aria-label="Illustration of a woman typing on a laptop while a small robot waves beside her">
      <circle cx="190" cy="140" r="118" fill="#8EB69B" opacity=".22" />
      <Cloud x="40" y="60" s={1} />
      <Cloud x="330" y="40" s={0.8} />
      <g transform="translate(300 40)">
        <path d="M0 0a28 28 0 1 1 28 38l-4 16-14-12A28 28 0 0 1 0 0Z" className={PAPER} strokeWidth="1.2" />
        <path d="M28 26c-9-7-14-10-14-16a7.5 7.5 0 0 1 14-3 7.5 7.5 0 0 1 14 3c0 6-5 9-14 16Z" fill="#E88F7A" />
      </g>
      <Plant x={30} y={262} s={1.2} />
      <Plant x={394} y={262} s={1.1} flip />
      <path d="M10 262H410" stroke="#235347" strokeWidth="3" strokeLinecap="round" />
      <Woman x={150} y={262} s={0.95} typing />
      <Laptop x={168} y={262} s={0.95} w={150} />
      <Robot x={318} y={190} s={0.85} />
    </svg>
  );
}

// ---------------------------------------------------------------- mini scenes for the feature cards (viewBox 240 x 120)
const MINI = 'w-full h-auto';

export function MiniJobs({ className = MINI }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <ellipse cx="120" cy="104" rx="104" ry="12" fill="#8EB69B" opacity=".25" />
      <Cloud x="18" y="14" s={0.8} />
      <rect x="130" y="22" width="86" height="30" rx="15" className={PAPER} strokeWidth="1.2" />
      <text x="146" y="42" fontSize="13" fontWeight="700" fill="#235347" fontFamily="system-ui, sans-serif">JOBS</text>
      <circle cx="196" cy="37" r="7" fill="none" stroke="#235347" strokeWidth="2.4" />
      <path d="m201 42 6 6" stroke="#235347" strokeWidth="2.4" strokeLinecap="round" />
      <Plant x={22} y={104} s={0.9} />
      <Plant x={218} y={104} s={0.8} flip />
      <Woman x={78} y={104} s={0.34} />
      <Laptop x={96} y={104} s={0.4} w={140} />
    </svg>
  );
}

export function MiniDashboard({ className = MINI }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <ellipse cx="120" cy="106" rx="104" ry="12" fill="#8EB69B" opacity=".25" />
      <rect x="46" y="14" width="140" height="86" rx="8" className={PAPER} strokeWidth="1.4" />
      <path d="M46 28h140" stroke="#8EB69B" strokeWidth="1.2" />
      <circle cx="56" cy="21" r="2.4" fill="#8EB69B" />
      <circle cx="64" cy="21" r="2.4" fill="#8EB69B" opacity=".6" />
      <g fill="#8EB69B">
        <rect x="62" y="74" width="14" height="16" rx="2" opacity=".5" />
        <rect x="82" y="66" width="14" height="24" rx="2" opacity=".65" />
        <rect x="102" y="56" width="14" height="34" rx="2" opacity=".8" />
        <rect x="122" y="46" width="14" height="44" rx="2" fill="#5C8A6A" />
        <rect x="142" y="38" width="14" height="52" rx="2" fill="#235347" />
      </g>
      <circle cx="190" cy="92" r="14" fill="#235347" />
      <path d="m183 92 5 5 9-10" stroke="#DAF1DE" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Plant x={26} y={104} s={0.8} />
    </svg>
  );
}

export function MiniResume({ className = MINI }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <ellipse cx="120" cy="106" rx="104" ry="12" fill="#8EB69B" opacity=".25" />
      <rect x="54" y="12" width="104" height="90" rx="8" className={PAPER} strokeWidth="1.4" />
      <circle cx="72" cy="30" r="8" fill="#8EB69B" opacity=".6" />
      <rect x="86" y="25" width="38" height="5" rx="2.5" fill="#8EB69B" opacity=".6" />
      <g stroke="#235347" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="m66 52 3 3 6-6M66 68l3 3 6-6M66 84l3 3 6-6" />
      </g>
      <g fill="#8EB69B" opacity=".55">
        <rect x="82" y="50" width="42" height="5" rx="2.5" />
        <rect x="82" y="66" width="34" height="5" rx="2.5" />
        <rect x="82" y="82" width="40" height="5" rx="2.5" />
      </g>
      {/* decorative ring, not a real score */}
      <circle cx="162" cy="66" r="22" fill="#F3FAF5" className="dark:fill-[#123A34]" />
      <circle cx="162" cy="66" r="16" fill="none" stroke="#DAF1DE" strokeWidth="7" />
      <circle cx="162" cy="66" r="16" fill="none" stroke="#5C8A6A" strokeWidth="7" strokeLinecap="round" strokeDasharray="72 100" transform="rotate(-90 162 66)" />
      <Plant x={30} y={104} s={0.85} />
      <Plant x={214} y={104} s={0.8} flip />
    </svg>
  );
}

export function MiniLetter({ className = MINI }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <ellipse cx="120" cy="106" rx="104" ry="12" fill="#8EB69B" opacity=".25" />
      <rect x="52" y="22" width="136" height="76" rx="8" className={PAPER} strokeWidth="1.4" />
      <text x="66" y="42" fontSize="11" fontWeight="600" fill="#235347" fontFamily="system-ui, sans-serif">Cover Letter</text>
      <g fill="#8EB69B" opacity=".55">
        <rect x="66" y="52" width="108" height="5" rx="2.5" />
        <rect x="66" y="64" width="90" height="5" rx="2.5" />
        <rect x="66" y="76" width="100" height="5" rx="2.5" />
      </g>
      <path d="M40 24l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#E7C45F" />
      <path d="M204 30l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4Z" fill="#E7C45F" />
      <Plant x={30} y={104} s={0.8} />
      <Plant x={214} y={104} s={0.8} flip />
    </svg>
  );
}

function Person({ x, y, flip = false, shirt = '#7FA68A', hair = HAIR }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-18 0c0-22 8-36 18-36s18 14 18 36Z" fill={shirt} />
      <path d="M-14 -44c-4-14 4-26 14-26s18 12 14 26c2 8 4 16 0 22-6-4-8-8-8-12h-12c0 4-2 8-8 12-4-6-2-14 0-22Z" fill={hair} />
      <ellipse cx="0" cy="-48" rx="11" ry="12" fill={SKIN} />
      <path d="M14 -28c10-8 18-20 22-34" stroke={shirt} strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="37" cy="-66" r="5" fill={SKIN} />
    </g>
  );
}

export function MiniPeople({ className = MINI }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <ellipse cx="120" cy="106" rx="104" ry="12" fill="#8EB69B" opacity=".25" />
      <g stroke="#E7C45F" strokeWidth="2.4" strokeLinecap="round">
        <path d="M120 14v8M104 20l4 6M136 20l-4 6" />
      </g>
      <circle cx="120" cy="38" r="5" fill="#E7C45F" opacity=".7" />
      <Person x={84} y={104} />
      <Person x={156} y={104} flip shirt="#5C8A6A" />
      <Plant x={26} y={104} s={0.8} />
      <Plant x={216} y={104} s={0.8} flip />
    </svg>
  );
}

// Generic, quiet leaf motif for cards without a dedicated scene.
export function MiniLeaves({ className = MINI }) {
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <ellipse cx="120" cy="106" rx="104" ry="12" fill="#8EB69B" opacity=".25" />
      <Cloud x="150" y="26" s={1} />
      <Plant x={80} y={104} s={1.3} />
      <Plant x={130} y={104} s={1.0} flip />
      <Plant x={178} y={104} s={0.8} />
    </svg>
  );
}

export function Sprig({ className = '' }) {
  return (
    <svg viewBox="0 0 80 120" className={className} aria-hidden="true">
      <path d="M40 116V56" stroke="#5C8A6A" strokeWidth="3" strokeLinecap="round" />
      <Leaf x={40} y={90} r={-50} s={1.1} fill="#6FA183" />
      <Leaf x={40} y={76} r={50} s={1.1} fill="#8EB69B" />
      <Leaf x={40} y={62} r={-40} s={0.9} fill="#5C8A6A" />
      <Leaf x={40} y={56} r={5} s={1.1} fill="#6FA183" />
    </svg>
  );
}
