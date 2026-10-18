/**
 * A detailed family homestead scene for the login gate (pure SVG, no external art).
 * Every colour is a CSS variable, so the same drawing becomes a warm golden-hour
 * countryside in light mode and a moonlit, firefly-lit night in dark mode.
 */
import { cn } from "@/lib/utils";

const f = (v: string) => ({ fill: `var(${v})` });

/** A simple rounded silhouette of a person — tall for grown-ups, short for children. */
function personFig(x: number, y: number, h: number, fill = "--trunk") {
  const r = h * 0.19;
  const headCy = y - h + r;
  const bodyTop = headCy + r * 1.25;
  return (
    <g style={{ fill: `var(${fill})` }}>
      <circle cx={x} cy={headCy} r={r} />
      <path d={`M${x - h * 0.2} ${y} Q ${x - h * 0.26} ${bodyTop} ${x} ${bodyTop} Q ${x + h * 0.26} ${bodyTop} ${x + h * 0.2} ${y} Z`} />
    </g>
  );
}

/** A little stacked pine. */
function pine(x: number, baseY: number, s: number, tone = "--tree-mid") {
  return (
    <g style={f(tone)} transform={`translate(${x} ${baseY}) scale(${s})`}>
      <rect x="-4" y="-8" width="8" height="18" style={f("--trunk")} />
      <path d="M0 -70 L26 -20 L-26 -20 Z" />
      <path d="M0 -54 L30 2 L-30 2 Z" />
      <path d="M0 -36 L34 24 L-34 24 Z" />
    </g>
  );
}

export function Homestead({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--sky-top)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--sky-mid)" }} />
            <stop offset="1" style={{ stopColor: "var(--horizon)" }} />
          </linearGradient>
          <radialGradient id="hs-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" style={{ stopColor: "var(--sunglow)", stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: "var(--sunglow)", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="hs-water" cx="0.5" cy="0.2" r="0.9">
            <stop offset="0" style={{ stopColor: "var(--sky-top)", stopOpacity: 0.9 }} />
            <stop offset="1" style={{ stopColor: "var(--sky-mid)", stopOpacity: 0.7 }} />
          </radialGradient>
          <filter id="hs-soft" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="9" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#hs-sky)" />

        {/* ---- night sky: stars + shooting glimmer ---- */}
        <g className="hidden dark:block" fill="#fff7dc">
          {[[90,70],[180,140],[300,60],[430,120],[560,80],[640,170],[760,60],[560,220],[150,240],[1540,120],[1480,240],[60,160],[1120,70],[1230,150],[980,60],[1360,90]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={i%3===0?2.4:1.4} opacity={0.5 + (i%4)*0.12} className="firefly" style={{ animationDelay: `${i*0.4}s` }} />
          ))}
        </g>

        {/* ---- sun (day) / moon (night), top-right ---- */}
        <g className="bob" style={{ animationDuration: "12s" }}>
          <circle cx="1330" cy="188" r="230" fill="url(#hs-glow)" />
          {/* day sun with soft rays */}
          <g className="dark:hidden">
            <g stroke="var(--sun)" strokeWidth="6" strokeLinecap="round" opacity="0.5">
              {[...Array(12)].map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return <line key={i} x1={1330 + Math.cos(a) * 92} y1={188 + Math.sin(a) * 92} x2={1330 + Math.cos(a) * 116} y2={188 + Math.sin(a) * 116} />;
              })}
            </g>
            <circle cx="1330" cy="188" r="78" style={f("--sun")} />
            <circle cx="1330" cy="188" r="78" fill="url(#hs-glow)" opacity="0.6" />
          </g>
          {/* night moon with craters */}
          <g className="hidden dark:block">
            <circle cx="1330" cy="188" r="74" fill="#f3ead0" />
            <g fill="#dcd2b4" opacity="0.7">
              <circle cx="1306" cy="168" r="13" />
              <circle cx="1352" cy="200" r="18" />
              <circle cx="1318" cy="214" r="9" />
              <circle cx="1358" cy="160" r="7" />
            </g>
          </g>
        </g>

        {/* ---- drifting clouds (day) / thin night wisps ---- */}
        {[{ y: 110, s: 1, d: 150, o: 0 }, { y: 200, s: 0.66, d: 200, o: -70 }, { y: 60, s: 0.5, d: 240, o: -130 }].map((c, i) => (
          <g key={i} className="cloud" style={{ animationDuration: `${c.d}s`, animationDelay: `${c.o}s` }}>
            <g transform={`translate(0 ${c.y}) scale(${c.s})`} style={f("--cloud")} opacity={0.85}>
              <ellipse cx="120" cy="40" rx="130" ry="34" />
              <ellipse cx="66" cy="22" rx="60" ry="42" />
              <ellipse cx="150" cy="8" rx="74" ry="52" />
              <ellipse cx="226" cy="32" rx="62" ry="34" />
            </g>
          </g>
        ))}

        {/* ---- mountains: far snow-capped range ---- */}
        <path filter="url(#hs-soft)" style={f("--mount-far")}
          d="M0 500 L130 360 L210 430 L320 300 L430 410 L540 340 L660 450 L780 320 L900 430 L1030 310 L1160 430 L1290 350 L1420 440 L1600 340 L1600 600 L0 600 Z" />
        {/* snow caps */}
        <g style={f("--cloud")} opacity="0.92">
          <path d="M320 300 L352 338 L300 338 Z" />
          <path d="M780 320 L812 356 L748 356 Z" />
          <path d="M1030 310 L1064 350 L996 350 Z" />
        </g>
        {/* nearer, greener range */}
        <path filter="url(#hs-soft)" style={f("--mount-near")} opacity="0.95"
          d="M0 560 L140 470 L280 540 L400 440 L540 540 L660 470 L800 550 L950 460 L1110 550 L1250 470 L1400 540 L1600 450 L1600 660 L0 660 Z" />

        {/* ---- a line of pines along the ridge ---- */}
        {pine(120, 572, 0.8, "--tree-dark")}
        {pine(205, 580, 0.6, "--tree-dark")}
        {pine(1500, 580, 0.9, "--tree-dark")}
        {pine(1420, 592, 0.65, "--tree-dark")}

        {/* ---- rolling hills ---- */}
        <path style={f("--hill-1")} d="M0 620 C 240 540, 440 580, 660 600 S 1080 540, 1320 580 S 1540 600, 1600 570 L1600 900 L0 900 Z" />
        <path style={f("--hill-2")} d="M0 690 C 200 620, 400 640, 580 670 S 920 630, 1120 650 S 1460 690, 1600 640 L1600 900 L0 900 Z" />

        {/* ---- a calm pond catching the sky ---- */}
        <g>
          <ellipse cx="1160" cy="724" rx="190" ry="40" fill="url(#hs-water)" />
          <g stroke="var(--cloud)" strokeWidth="3" strokeLinecap="round" opacity="0.5">
            <line x1="1070" y1="720" x2="1120" y2="720" />
            <line x1="1150" y1="732" x2="1210" y2="732" />
            <line x1="1110" y1="742" x2="1150" y2="742" />
          </g>
        </g>

        {/* ---- the great family tree with a swing ---- */}
        <g className="sway" style={{ transformOrigin: "1300px 700px" }}>
          <path style={f("--trunk")} d="M1286 712 C 1290 650, 1280 620, 1264 584 C 1286 610, 1300 618, 1308 636 C 1316 610, 1336 598, 1356 588 C 1336 622, 1326 660, 1328 712 Z" />
          <g filter="url(#hs-soft)">
            <ellipse cx="1302" cy="556" rx="140" ry="84" style={f("--tree-dark")} />
            <ellipse cx="1228" cy="534" rx="82" ry="60" style={f("--tree-mid")} />
            <ellipse cx="1372" cy="528" rx="88" ry="62" style={f("--tree-mid")} />
            <ellipse cx="1298" cy="492" rx="98" ry="64" style={f("--tree-light")} />
            <ellipse cx="1338" cy="476" rx="46" ry="30" style={f("--hill-1")} opacity="0.65" />
          </g>
        </g>
        {/* swing hung from a branch */}
        <g style={{ stroke: "var(--trunk)" }} strokeWidth="3" strokeLinecap="round">
          <line x1="1320" y1="568" x2="1316" y2="664" />
          <line x1="1354" y1="568" x2="1358" y2="664" />
          <line x1="1312" y1="664" x2="1362" y2="664" strokeWidth="6" />
        </g>
        {personFig(1337, 662, 22)}

        {/* ---- birds heading home ---- */}
        <g stroke="var(--trunk)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" className="bob" style={{ animationDuration: "9s" }}>
          <path d="M300 250 Q 314 238 328 250 Q 342 238 356 250" />
          <path d="M408 220 Q 419 211 430 220 Q 441 211 452 220" />
          <path d="M210 300 Q 221 291 232 300 Q 243 291 254 300" />
        </g>

        <path style={f("--hill-3")} d="M0 770 C 240 710, 460 748, 700 764 S 1180 726, 1400 756 S 1560 768, 1600 748 L1600 900 L0 900 Z" />

        {/* ================= THE FAMILY HOME ================= */}
        <g transform="translate(150 466)">
          {/* warm light pooling across the yard */}
          <ellipse cx="150" cy="330" rx="300" ry="96" fill="url(#hs-glow)" opacity="0.5" />
          {/* ground shadow */}
          <ellipse cx="150" cy="292" rx="215" ry="26" style={f("--hill-4")} opacity="0.55" />

          {/* side wing */}
          <rect x="250" y="150" width="120" height="130" rx="4" style={f("--wall")} />
          <path d="M238 154 L310 96 L382 154 Z" style={f("--roof")} />
          <rect x="286" y="176" width="48" height="46" rx="4" style={f("--window")} />
          <path d="M310 176 L310 222 M286 199 L334 199" stroke="var(--roof)" strokeWidth="2" opacity="0.45" />

          {/* main two-storey body */}
          <rect x="0" y="80" width="300" height="200" rx="4" style={f("--wall")} />
          {/* storey trim */}
          <rect x="0" y="172" width="300" height="7" style={f("--roof")} opacity="0.35" />
          {/* gable roof + eaves */}
          <path d="M-26 86 L150 -28 L326 86 Z" style={f("--roof")} />
          <path d="M-26 86 L326 86 L326 98 L-26 98 Z" style={f("--roof")} opacity="0.8" />
          {/* gable attic window */}
          <circle cx="150" cy="44" r="16" style={f("--window")} />
          <circle cx="150" cy="44" r="16" fill="none" stroke="var(--roof)" strokeWidth="2.5" opacity="0.5" />

          {/* chimney + smoke */}
          <rect x="228" y="-6" width="30" height="66" style={f("--roof")} />
          <rect x="222" y="-14" width="42" height="14" style={f("--roof")} />
          <path className="bob" d="M243 -22 C 228 -44, 260 -60, 243 -84 C 232 -100, 256 -112, 249 -134"
            stroke="var(--cloud)" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.65" />

          {/* upstairs windows (warm panes) */}
          {[36, 206].map((wx) => (
            <g key={wx}>
              <rect x={wx - 6} y="98" width="70" height="66" rx="4" fill="url(#hs-glow)" opacity="0.6" />
              <rect x={wx} y="104" width="58" height="56" rx="4" style={f("--window")} />
              <path d={`M${wx + 29} 104 L${wx + 29} 160 M${wx} 132 L${wx + 58} 132`} stroke="var(--roof)" strokeWidth="2.5" opacity="0.5" />
            </g>
          ))}

          {/* downstairs windows flanking the door */}
          {[18, 224].map((wx) => (
            <g key={wx}>
              <rect x={wx} y="196" width="58" height="66" rx="4" style={f("--window")} />
              <path d={`M${wx + 29} 196 L${wx + 29} 262 M${wx} 229 L${wx + 58} 229`} stroke="var(--roof)" strokeWidth="2.5" opacity="0.5" />
            </g>
          ))}

          {/* covered porch */}
          <path d="M92 198 L150 150 L208 198 Z" style={f("--roof")} />
          <rect x="104" y="198" width="10" height="82" style={f("--trunk")} />
          <rect x="186" y="198" width="10" height="82" style={f("--trunk")} />
          <rect x="104" y="238" width="92" height="6" style={f("--trunk")} opacity="0.8" />
          {/* porch lantern */}
          <line x1="150" y1="162" x2="150" y2="176" stroke="var(--trunk)" strokeWidth="2" />
          <circle cx="150" cy="182" r="12" fill="url(#hs-glow)" opacity="0.9" />
          <circle cx="150" cy="182" r="5" style={f("--window")} />

          {/* arched front door, left ajar with light spilling out */}
          <path d="M122 280 L122 218 Q 150 194 178 218 L178 280 Z" style={f("--trunk")} />
          <path d="M152 280 L152 210 Q 166 210 172 222 L172 280 Z" style={f("--window")} opacity="0.9" />
          <circle cx="146" cy="250" r="3" style={f("--gold")} />
          {/* steps */}
          <rect x="112" y="280" width="78" height="8" style={f("--wall")} />
          <rect x="102" y="288" width="98" height="9" style={f("--wall")} opacity="0.85" />

          {/* picket fence + garden gate */}
          <g style={f("--wall")}>
            {[...Array(18)].map((_, i) => {
              const px = -40 + i * 24;
              if (px > 110 && px < 190) return null; // gap for the gate/path
              return <path key={i} d={`M${px} 322 L${px} 298 L${px + 6} 290 L${px + 12} 298 L${px + 12} 322 Z`} />;
            })}
          </g>
          <rect x="-40" y="304" width="360" height="6" style={f("--wall")} />

          {/* garden bushes + blooms */}
          <g>
            <ellipse cx="-8" cy="286" rx="26" ry="18" style={f("--tree-mid")} />
            <ellipse cx="316" cy="286" rx="24" ry="16" style={f("--tree-mid")} />
            {[[-16,278],[0,282],[308,278],[324,282]].map(([bx,by],i)=>(
              <circle key={i} cx={bx} cy={by} r="3.5" style={{ fill: i % 2 ? "var(--rose)" : "var(--sun)" }} />
            ))}
          </g>
        </g>
        {/* ================= END HOME ================= */}

        {/* lit garden path from the gate toward the foreground */}
        <path d="M300 788 C 340 824, 360 856, 380 900 L 470 900 C 452 858, 436 826, 408 790 Z"
          style={f("--horizon")} opacity="0.8" />

        <path style={f("--hill-4")} d="M0 824 C 300 786, 520 834, 800 834 S 1300 794, 1600 824 L1600 900 L0 900 Z" />

        {/* ---- family in the foreground, walking home hand in hand ---- */}
        <g>
          <ellipse cx="470" cy="866" rx="180" ry="72" fill="url(#hs-glow)" opacity="0.5" />
          {/* picnic blanket + basket on the lawn */}
          <g transform="translate(96 852)">
            <path d="M0 22 L120 8 L132 44 L10 60 Z" style={f("--rose")} opacity="0.92" />
            <path d="M26 14 L36 50 M62 10 L72 47 M98 11 L106 46 M4 36 L128 20" stroke="var(--wall)" strokeWidth="2" opacity="0.4" />
            <rect x="54" y="2" width="26" height="18" rx="4" style={f("--trunk")} />
            <path d="M54 4 Q 67 -10 80 4" fill="none" stroke="var(--trunk)" strokeWidth="3" />
          </g>
          {/* lanterns lighting the path */}
          {[[352, 828], [560, 850]].map(([lx, ly], i) => (
            <g key={i} transform={`translate(${lx} ${ly})`}>
              <circle cx="0" cy="-6" r="16" fill="url(#hs-glow)" opacity="0.9" />
              <rect x="-2.5" y="-6" width="5" height="42" rx="2" style={f("--trunk")} />
              <circle cx="0" cy="-6" r="6" style={f("--window")} />
            </g>
          ))}
          {/* the family, holding hands */}
          <path d="M416 866 L444 868 M444 868 L470 868 M470 868 L498 866" stroke="var(--trunk)" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
          {personFig(416, 890, 40)}
          {personFig(444, 890, 24)}
          {personFig(470, 890, 24)}
          {personFig(498, 890, 38)}
          {/* their little dog */}
          <g style={f("--trunk")}>
            <ellipse cx="528" cy="884" rx="12" ry="6.5" />
            <circle cx="539" cy="877" r="5" />
            <rect x="520" y="884" width="2.8" height="9" />
            <rect x="533" y="884" width="2.8" height="9" />
            <path d="M516 879 Q 509 876 513 887" fill="none" stroke="var(--trunk)" strokeWidth="2.6" />
          </g>
        </g>

        {/* ---- meadow flowers scattered up front ---- */}
        <g>
          {[[70,872],[200,888],[640,872],[760,888],[900,874],[1180,884],[1320,872],[1470,886],[1540,868],[1020,890]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={i%3?4:5} style={{ fill: i%2 ? "var(--sun)" : "#fffaf0" }} opacity="0.9" />
          ))}
        </g>
      </svg>
    </div>
  );
}
