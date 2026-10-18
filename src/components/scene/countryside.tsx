/**
 * Original hand-drawn-style countryside scenery for Hiraya (pure SVG, no external art).
 * Colors come from CSS variables so the same scene becomes a starry firefly
 * meadow in dark mode.
 */
import { cn } from "@/lib/utils";

const f = (v: string) => ({ fill: `var(${v})` });

export function Countryside({ variant = "home", align = "bottom", className }: { variant?: "gate" | "home" | "subtle"; align?: "bottom" | "middle"; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio={align === "middle" ? "xMidYMid slice" : "xMidYMax slice"} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--sky-top)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--sky-mid)" }} />
            <stop offset="1" style={{ stopColor: "var(--horizon)" }} />
          </linearGradient>
          <radialGradient id="sunglow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" style={{ stopColor: "var(--sunglow)", stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: "var(--sunglow)", stopOpacity: 0 }} />
          </radialGradient>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="4" result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale="10" />
          </filter>
          <filter id="blur6"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        <rect width="1600" height="900" fill="url(#sky)" />

        {/* stars (visible mostly at night: they share the cloud color) */}
        <g className="hidden dark:block" fill="#fff7dc">
          {[[120,80],[260,150],[410,60],[520,190],[690,110],[860,70],[980,160],[1120,90],[1270,140],[1420,70],[1510,180],[330,240],[760,230],[1190,230],[60,200],[1560,260]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={i%3===0?2.2:1.4} opacity={0.5 + (i%4)*0.12} />
          ))}
        </g>

        {/* sun by day, moon by night */}
        <g className="bob" style={{ animationDuration: "11s" }}>
          <circle cx="1240" cy="190" r="190" fill="url(#sunglow)" />
          <circle cx="1240" cy="190" r="62" style={{ fill: "var(--sun)" }} className="dark:hidden" />
          <g className="hidden dark:block">
            <circle cx="1240" cy="190" r="54" fill="#f5ecd0" />
            <circle cx="1262" cy="176" r="46" style={{ fill: "var(--sky-top)" }} opacity="0.92" />
          </g>
        </g>

        {/* drifting clouds */}
        {[{ y: 120, s: 1, d: 140, o: 0 }, { y: 210, s: 0.7, d: 190, o: -60 }, { y: 70, s: 0.55, d: 230, o: -120 }].map((c, i) => (
          <g key={i} className="cloud" style={{ animationDuration: `${c.d}s`, animationDelay: `${c.o}s` }}>
            <g transform={`translate(0 ${c.y}) scale(${c.s})`} style={{ fill: "var(--cloud)" }} opacity={0.88}>
              <ellipse cx="120" cy="40" rx="120" ry="34" />
              <ellipse cx="70" cy="22" rx="58" ry="40" />
              <ellipse cx="150" cy="10" rx="70" ry="50" />
              <ellipse cx="220" cy="32" rx="60" ry="32" />
            </g>
          </g>
        ))}

        {/* distant mountains */}
        <path filter="url(#soft)" style={f("--mount-far")} d="M0 520 L140 400 L230 450 L360 330 L470 420 L560 370 L700 470 L820 360 L940 440 L1060 340 L1180 430 L1300 380 L1430 450 L1600 360 L1600 640 L0 640 Z" />
        <path filter="url(#soft)" style={f("--mount-near")} d="M0 580 L120 500 L260 560 L380 470 L520 560 L640 500 L780 570 L930 490 L1090 570 L1230 500 L1380 560 L1600 480 L1600 680 L0 680 Z" opacity="0.9" />

        {/* rolling hills */}
        <path style={f("--hill-1")} d="M0 640 C 220 560, 420 600, 640 620 S 1060 560, 1300 600 S 1520 620, 1600 590 L1600 900 L0 900 Z" />
        <path style={f("--hill-2")} d="M0 700 C 180 640, 380 660, 560 690 S 900 650, 1100 670 S 1440 700, 1600 660 L1600 900 L0 900 Z" />

        {/* the great family tree on the far hill */}
        <g className="sway" style={{ transformOrigin: "1080px 660px" }}>
          <path style={f("--trunk")} d="M1068 668 C 1070 620, 1062 600, 1050 570 C 1066 590, 1078 596, 1084 610 C 1090 590, 1104 580, 1118 572 C 1104 600, 1096 630, 1098 668 Z" />
          <g filter="url(#soft)">
            <ellipse cx="1082" cy="540" rx="120" ry="70" style={f("--tree-dark")} />
            <ellipse cx="1020" cy="520" rx="70" ry="52" style={f("--tree-mid")} />
            <ellipse cx="1140" cy="515" rx="76" ry="54" style={f("--tree-mid")} />
            <ellipse cx="1078" cy="484" rx="84" ry="56" style={f("--tree-light")} />
            <ellipse cx="1110" cy="470" rx="40" ry="26" style={f("--hill-1")} opacity="0.7" />
          </g>
        </g>

        {variant === "gate" && (
          /* a swing hung from the family tree, and birds heading home */
          <g>
            <g style={{ stroke: "var(--trunk)" }} strokeWidth="3" strokeLinecap="round">
              <line x1="1104" y1="548" x2="1101" y2="628" />
              <line x1="1134" y1="548" x2="1137" y2="628" />
              <line x1="1097" y1="628" x2="1141" y2="628" strokeWidth="6" />
            </g>
            {personFig(1119, 626, 20)}
            <g stroke="var(--trunk)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" className="bob" style={{ animationDuration: "9s" }}>
              <path d="M360 182 Q 374 170 388 182 Q 402 170 416 182" />
              <path d="M468 150 Q 479 141 490 150 Q 501 141 512 150" />
              <path d="M250 228 Q 261 219 272 228 Q 283 219 294 228" />
            </g>
          </g>
        )}

        {variant === "gate" && (
          /* cozy cottage with warm, lit windows and a curl of chimney smoke */
          <g transform="translate(300 600)">
            {/* warm light pooling out from home */}
            <ellipse cx="60" cy="92" rx="112" ry="56" fill="url(#sunglow)" opacity="0.55" />
            <rect x="0" y="40" width="130" height="80" rx="6" style={f("--wall")} />
            <path d="M-14 46 L65 -10 L144 46 Z" style={f("--roof")} />
            <rect x="96" y="-12" width="16" height="34" style={f("--trunk")} />
            {/* glowing attic + front windows with little panes */}
            <circle cx="65" cy="26" r="9" style={f("--window")} />
            <circle cx="65" cy="26" r="9" fill="none" stroke="var(--roof)" strokeWidth="2" opacity="0.5" />
            <rect x="18" y="60" width="28" height="26" rx="4" style={f("--window")} />
            <rect x="31" y="60" width="2" height="26" style={f("--roof")} opacity="0.45" />
            <rect x="18" y="72" width="28" height="2" style={f("--roof")} opacity="0.45" />
            {/* door left ajar, warm light spilling onto the step */}
            <rect x="84" y="70" width="28" height="50" rx="12" style={f("--trunk")} />
            <rect x="99" y="74" width="11" height="46" rx="5" style={f("--window")} opacity="0.9" />
            <path className="bob" d="M104 -20 C 90 -40, 120 -54, 104 -76 C 94 -90, 116 -100, 110 -118" stroke="var(--cloud)" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.7" />
          </g>
        )}

        <path style={f("--hill-3")} d="M0 760 C 240 700, 460 740, 700 760 S 1180 720, 1400 750 S 1560 760, 1600 740 L1600 900 L0 900 Z" />

        {variant === "gate" && (
          /* winding path and a little wooden gate */
          <g>
            <path d="M660 900 C 700 840, 760 820, 790 790 S 840 760, 860 752 L 900 752 C 890 770, 870 790, 860 810 S 900 870, 960 900 Z" style={{ fill: "var(--horizon)" }} opacity="0.85" />
            <g transform="translate(740 700)" style={{ stroke: "var(--trunk)" }} strokeWidth="9" strokeLinecap="round">
              <line x1="0" y1="0" x2="0" y2="80" />
              <line x1="230" y1="0" x2="230" y2="80" />
              <line x1="0" y1="20" x2="230" y2="20" />
              <line x1="0" y1="55" x2="230" y2="55" />
              <line x1="0" y1="55" x2="230" y2="20" strokeWidth="6" />
              <path d="M-6 -6 Q 115 -46 236 -6" fill="none" strokeWidth="7" />
            </g>
            {[...Array(9)].map((_, i) => (
              <circle key={i} cx={760 + i * 26} cy={662 - Math.sin((i / 8) * Math.PI) * 38} r="6" style={{ fill: i % 2 ? "var(--rose)" : "var(--sun)" }} />
            ))}
          </g>
        )}

        <path style={f("--hill-4")} d="M0 820 C 300 780, 520 830, 800 830 S 1300 790, 1600 820 L1600 900 L0 900 Z" />

        {variant === "gate" && (
          /* a family walking home together, hand in hand, with their dog */
          <g>
            {/* warm pool of light they walk through */}
            <ellipse cx="742" cy="864" rx="172" ry="74" fill="url(#sunglow)" opacity="0.5" />
            {/* picnic blanket + basket resting on the lawn */}
            <g transform="translate(150 848)">
              <path d="M0 22 L118 8 L130 42 L10 58 Z" style={f("--rose")} opacity="0.92" />
              <path d="M24 13 L34 48 M60 10 L70 45 M96 11 L104 44 M4 34 L126 20" stroke="var(--wall)" strokeWidth="2" opacity="0.4" />
              <rect x="52" y="2" width="26" height="18" rx="4" style={f("--trunk")} />
              <path d="M52 4 Q 65 -10 78 4" fill="none" stroke="var(--trunk)" strokeWidth="3" />
            </g>
            {/* lanterns lighting the way */}
            {[[618, 826], [980, 842]].map(([lx, ly], i) => (
              <g key={i} transform={`translate(${lx} ${ly})`}>
                <circle cx="0" cy="-6" r="16" fill="url(#sunglow)" opacity="0.9" />
                <rect x="-2.5" y="-6" width="5" height="40" rx="2" style={f("--trunk")} />
                <circle cx="0" cy="-6" r="6" style={f("--window")} />
              </g>
            ))}
            {/* the family, holding hands */}
            <path d="M688 862 L714 864 M714 864 L738 864 M738 864 L766 862" stroke="var(--trunk)" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
            {personFig(688, 884, 38)}
            {personFig(714, 884, 23)}
            {personFig(738, 884, 23)}
            {personFig(766, 884, 36)}
            {/* their little dog */}
            <g style={f("--trunk")}>
              <ellipse cx="794" cy="879" rx="11" ry="6" />
              <circle cx="804" cy="873" r="4.5" />
              <rect x="787" y="879" width="2.6" height="8" />
              <rect x="799" y="879" width="2.6" height="8" />
              <path d="M783 875 Q 777 872 780 882" fill="none" stroke="var(--trunk)" strokeWidth="2.5" />
            </g>
          </g>
        )}

        {/* meadow flowers */}
        <g>
          {[[90,850],[180,872],[420,860],[560,880],[1180,860],[1320,876],[1460,848],[1530,880],[980,880],[260,840]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={i%3?4:5} style={{ fill: i%2 ? "var(--sun)" : "#fffaf0" }} opacity="0.9" />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** A simple rounded silhouette of a person — tall for grown-ups, short for children. */
function personFig(x: number, y: number, h: number) {
  const r = h * 0.19;
  const headCy = y - h + r;
  const bodyTop = headCy + r * 1.25;
  return (
    <g style={{ fill: "var(--trunk)" }}>
      <circle cx={x} cy={headCy} r={r} />
      <path d={`M${x - h * 0.2} ${y} Q ${x - h * 0.26} ${bodyTop} ${x} ${bodyTop} Q ${x + h * 0.26} ${bodyTop} ${x + h * 0.2} ${y} Z`} />
    </g>
  );
}
