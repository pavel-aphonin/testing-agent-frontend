/**
 * Product logo — renders one of three modes depending on custom branding:
 *
 *   1. No custom images → animated 3D flip "М" ↔ Alfa "A+bar" (default Markov brand)
 *   2. Only ``logoUrl`` set → static <img> with the admin-uploaded logo
 *   3. Both ``logoUrl`` and ``logoBackUrl`` set → 3D flip between the two
 *
 * The animation is pure CSS (no JS timers). Safe to mount multiple times.
 */

interface Props {
  /** Pixel size of the outer square. Default 32 (sidebar size). */
  size?: number;
  /** Seconds per flip cycle. Longer = calmer. */
  durationSec?: number;
  /** Optional className for layout overrides. */
  className?: string;
  /** Admin-uploaded front-face logo URL. Falls back to the animated Markov mark. */
  logoUrl?: string | null;
  /**
   * Optional back-face image. Only used when ``logoUrl`` is also set.
   * When omitted, a set ``logoUrl`` renders as a static image.
   */
  logoBackUrl?: string | null;
}

export function MarkovLogo({
  size = 32,
  durationSec = 5,
  className,
  logoUrl,
  logoBackUrl,
}: Props) {
  const fontSize = Math.round(size * 0.56);
  const aFont = Math.round(size * 0.5);
  const barW = Math.round(size * 0.44);
  const barH = Math.max(2, Math.round(size * 0.078));
  const animName = `flipLogo${size}`;
  const radius = Math.round(size / 4);

  // ── Case 2: custom logo, no back face → static image ────────────────
  if (logoUrl && !logoBackUrl) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          flexShrink: 0,
        }}
      >
        <img
          src={logoUrl}
          alt="logo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      </span>
    );
  }

  // ── Case 3: custom flip between two admin-uploaded images ───────────
  if (logoUrl && logoBackUrl) {
    return (
      <>
        <style>{`
          @keyframes ${animName} {
            0%, 40%   { transform: rotateY(0deg); }
            50%, 90%  { transform: rotateY(180deg); }
            100%      { transform: rotateY(360deg); }
          }
        `}</style>
        <span
          className={className}
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            perspective: size * 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
            background: "transparent",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: size,
              height: size,
              position: "relative",
              transformStyle: "preserve-3d",
              animation: `${animName} ${durationSec}s ease-in-out infinite`,
            }}
          >
            <img
              src={logoUrl}
              alt="logo-front"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backfaceVisibility: "hidden",
              }}
            />
            <img
              src={logoBackUrl}
              alt="logo-back"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            />
          </span>
        </span>
      </>
    );
  }

  // ── Case 1 (default): built-in Markov / Alfa flip ───────────────────
  return (
    <>
      <style>{`
        @keyframes ${animName} {
          0%, 40%   { transform: rotateY(0deg); }
          50%, 90%  { transform: rotateY(180deg); }
          100%      { transform: rotateY(360deg); }
        }
      `}</style>
      <span
        className={className}
        style={{
          width: size,
          height: size,
          background: "#EE3424",
          borderRadius: radius,
          flexShrink: 0,
          perspective: size * 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: size,
            height: size,
            position: "relative",
            transformStyle: "preserve-3d",
            animation: `${animName} ${durationSec}s ease-in-out infinite`,
          }}
        >
          {/* Front face — single "М" */}
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backfaceVisibility: "hidden",
              fontSize,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            М
          </span>
          {/* Back face — Alfa Bank mark: white "A" + horizontal bar. */}
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              color: "#fff",
              gap: Math.max(1, Math.round(size * 0.03)),
            }}
          >
            <span style={{ fontSize: aFont, fontWeight: 800, lineHeight: 1 }}>A</span>
            <span style={{ width: barW, height: barH, background: "#fff", borderRadius: 1 }} />
          </span>
        </span>
      </span>
    </>
  );
}
