/**
 * PersonaTwin icon set.
 *
 * One shared idea runs through all of these: a small hub-and-spoke "node"
 * (a center point with three satellites) stands in for a person's three
 * tracked domains — financial, career, health — orbiting one identity.
 *
 * - TwinMark: the logo. Two hubs, offset and overlapping — the "twin."
 * - IconOverview: the hub's pulse — concentric scan rings, echoes the
 *   auth-screen background motif.
 * - IconProfiles: a single hub, literally the identity + 3 domains.
 * - IconSimulations: one node forking into two — a decision branching
 *   into a "what-if."
 *
 * Props match lucide-react's API (size, strokeWidth, className) so these
 * drop in wherever a lucide icon is used today, e.g.:
 *   <IconOverview size={16} strokeWidth={2} />
 */

const base = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function TwinMark({ size = 24, strokeWidth = 1.8, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      {...base}
      className={className}
      {...rest}
    >
      {/* back hub — the "echo" twin */}
      <g stroke="currentColor" opacity="0.4" strokeWidth={strokeWidth}>
        <line x1="19" y1="19" x2="19" y2="13" />
        <line x1="19" y1="19" x2="14" y2="22" />
        <line x1="19" y1="19" x2="24" y2="22" />
        <circle cx="19" cy="19" r="2.1" />
        <circle cx="19" cy="13" r="1.4" />
        <circle cx="14" cy="22" r="1.4" />
        <circle cx="24" cy="22" r="1.4" />
      </g>
      {/* front hub — the primary identity */}
      <g stroke="currentColor" strokeWidth={strokeWidth}>
        <line x1="13" y1="13" x2="13" y2="7" />
        <line x1="13" y1="13" x2="8" y2="16" />
        <line x1="13" y1="13" x2="18" y2="16" />
        <circle cx="13" cy="13" r="2.1" fill="currentColor" stroke="none" />
        <circle cx="13" cy="7" r="1.4" />
        <circle cx="8" cy="16" r="1.4" />
        <circle cx="18" cy="16" r="1.4" />
      </g>
    </svg>
  );
}

export function IconOverview({ size = 24, strokeWidth = 1.8, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...base}
      className={className}
      {...rest}
    >
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        opacity="0.45"
      />
    </svg>
  );
}

export function IconProfiles({ size = 24, strokeWidth = 1.8, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...base}
      className={className}
      {...rest}
    >
      <g stroke="currentColor" strokeWidth={strokeWidth}>
        <line x1="12" y1="12" x2="12" y2="6" />
        <line x1="12" y1="12" x2="7" y2="15.5" />
        <line x1="12" y1="12" x2="17" y2="15.5" />
      </g>
      <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6" r="1.6" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="7" cy="15.5" r="1.6" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="17" cy="15.5" r="1.6" stroke="currentColor" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function IconSimulations({ size = 24, strokeWidth = 1.8, className, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...base}
      className={className}
      {...rest}
    >
      <g stroke="currentColor" strokeWidth={strokeWidth}>
        <line x1="12" y1="19" x2="12" y2="13" />
        <line x1="12" y1="13" x2="7" y2="6" />
        <line x1="12" y1="13" x2="17" y2="6" />
      </g>
      <circle cx="12" cy="19" r="1.7" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="7" cy="6" r="1.7" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="17" cy="6" r="1.7" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="12" cy="13" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
