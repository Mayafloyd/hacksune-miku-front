import {
  ArrowUpRight,
  Refrigerator,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useRef, type PointerEvent } from "react";

type AgentKind = "sales" | "support";

interface AgentChoiceCardProps {
  kind: AgentKind;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  labels: string[];
}

export default function AgentChoiceCard({
  kind,
  eyebrow,
  title,
  description,
  cta,
  href,
  labels,
}: AgentChoiceCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const titleId = `agent-card-${kind}-title`;

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || !cardRef.current) return;

    const bounds = cardRef.current.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width;
    const vertical = (event.clientY - bounds.top) / bounds.height;
    const shiftX = (horizontal - 0.5) * 8;
    const shiftY = (vertical - 0.5) * 8;

    cardRef.current.style.setProperty("--card-shift-x", `${shiftX.toFixed(2)}px`);
    cardRef.current.style.setProperty("--card-shift-y", `${shiftY.toFixed(2)}px`);
    cardRef.current.style.setProperty(
      "--card-glow-x",
      `${(horizontal * 100).toFixed(1)}%`,
    );
    cardRef.current.style.setProperty(
      "--card-glow-y",
      `${(vertical * 100).toFixed(1)}%`,
    );
  };

  const resetPointerPosition = () => {
    cardRef.current?.style.setProperty("--card-shift-x", "0px");
    cardRef.current?.style.setProperty("--card-shift-y", "0px");
  };

  return (
    <article
      ref={cardRef}
      className={`hac-agent-card hac-agent-card--${kind}`}
      aria-labelledby={titleId}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerPosition}
    >
      <a
        className="hac-agent-card__link"
        href={href}
        aria-describedby={`${titleId}-description`}
        data-astro-prefetch="tap"
      >
        <span className="hac-agent-card__glow" aria-hidden="true" />

        <span className="hac-agent-card__topline">
          <span className="hac-agent-card__eyebrow">{eyebrow}</span>
          <span className="hac-agent-card__index" aria-hidden="true">
            {kind === "sales" ? "01" : "02"}
          </span>
        </span>

        <span className="hac-agent-card__icon-stage" aria-hidden="true">
          <span className="hac-agent-card__icon">
            {kind === "sales" ? (
              <Refrigerator size={31} strokeWidth={1.8} />
            ) : (
              <Wrench size={30} strokeWidth={1.8} />
            )}
          </span>
          <span className="hac-agent-card__icon-note">
            {kind === "sales" ? (
              <ShieldCheck size={15} strokeWidth={2} />
            ) : (
              <Refrigerator size={15} strokeWidth={2} />
            )}
          </span>
        </span>

        <span className="hac-agent-card__content">
          <h2 id={titleId}>{title}</h2>
          <span id={`${titleId}-description`} className="hac-agent-card__copy">
            {description}
          </span>
        </span>

        <ul className="hac-agent-card__tags" aria-label="Puedes consultar">
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>

        <span className="hac-agent-card__cta">
          <span>{cta}</span>
          <span className="hac-agent-card__arrow" aria-hidden="true">
            <ArrowUpRight size={20} strokeWidth={2.2} />
          </span>
        </span>
      </a>

      <style>{agentChoiceCardStyles}</style>
    </article>
  );
}

const agentChoiceCardStyles = `
  .hac-agent-card {
    --card-shift-x: 0px;
    --card-shift-y: 0px;
    --card-glow-x: 50%;
    --card-glow-y: 50%;
    position: relative;
    min-width: 0;
    min-height: 29rem;
    border: 1px solid var(--brand-border, #dfe1da);
    border-radius: var(--radius-card, 1.5rem);
    overflow: hidden;
    box-shadow: var(--shadow-card, 0 1rem 3rem rgb(17 17 17 / 0.08));
    transform: translate3d(
      var(--card-shift-x),
      var(--card-shift-y),
      0
    );
    transition:
      transform var(--motion-standard, 240ms)
        cubic-bezier(0.2, 0.75, 0.25, 1),
      border-color var(--motion-fast, 180ms) ease,
      box-shadow var(--motion-standard, 240ms) ease;
    will-change: transform;
  }

  .hac-agent-card--sales {
    background:
      linear-gradient(145deg, rgb(201 214 0 / 0.13), transparent 44%),
      var(--brand-white, #ffffff);
    color: var(--brand-black, #111111);
  }

  .hac-agent-card--support {
    border-color: #3c3c3c;
    background:
      linear-gradient(145deg, rgb(201 214 0 / 0.09), transparent 42%),
      var(--brand-graphite, #252525);
    color: var(--brand-white, #ffffff);
  }

  .hac-agent-card:hover {
    border-color: var(--brand-lime, #c9d600);
    box-shadow: 0 1.4rem 3.5rem rgb(17 17 17 / 0.15);
  }

  .hac-agent-card__link {
    position: relative;
    z-index: 1;
    display: flex;
    min-height: inherit;
    padding: clamp(1.35rem, 3.2vw, 2.15rem);
    flex-direction: column;
    color: inherit;
    text-decoration: none;
    isolation: isolate;
  }

  .hac-agent-card__link:focus-visible {
    outline: 3px solid var(--brand-lime, #c9d600);
    outline-offset: -5px;
  }

  .hac-agent-card__glow {
    position: absolute;
    z-index: -1;
    inset: 0;
    background: radial-gradient(
      circle at var(--card-glow-x) var(--card-glow-y),
      rgb(201 214 0 / 0.18),
      transparent 10rem
    );
    opacity: 0;
    transition: opacity var(--motion-standard, 240ms) ease;
    pointer-events: none;
  }

  .hac-agent-card:hover .hac-agent-card__glow {
    opacity: 1;
  }

  .hac-agent-card__topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .hac-agent-card__eyebrow,
  .hac-agent-card__index {
    font-size: 0.73rem;
    font-weight: 760;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .hac-agent-card__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
  }

  .hac-agent-card__eyebrow::before {
    width: 1.7rem;
    height: 0.18rem;
    border-radius: 999px;
    background: var(--brand-lime, #c9d600);
    content: "";
  }

  .hac-agent-card__index {
    opacity: 0.48;
    font-variant-numeric: tabular-nums;
  }

  .hac-agent-card__icon-stage {
    position: relative;
    display: inline-flex;
    width: 4.5rem;
    height: 4.5rem;
    margin-top: clamp(1.7rem, 4vw, 2.7rem);
    align-items: center;
    justify-content: center;
    border-radius: 1.25rem;
    background: var(--brand-lime, #c9d600);
    color: var(--brand-black, #111111);
    transform: rotate(-3deg);
    transition: transform var(--motion-standard, 240ms)
      cubic-bezier(0.2, 0.75, 0.25, 1);
  }

  .hac-agent-card:hover .hac-agent-card__icon-stage {
    transform: rotate(0deg);
  }

  .hac-agent-card__icon {
    display: inline-flex;
    transform: rotate(3deg);
    transition: transform var(--motion-standard, 240ms)
      cubic-bezier(0.2, 0.75, 0.25, 1);
  }

  .hac-agent-card:hover .hac-agent-card__icon {
    transform: rotate(0deg);
  }

  .hac-agent-card__icon-note {
    position: absolute;
    right: -0.55rem;
    bottom: -0.45rem;
    display: inline-grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border: 3px solid var(--brand-white, #ffffff);
    border-radius: 50%;
    background: var(--brand-black, #111111);
    color: var(--brand-lime, #c9d600);
  }

  .hac-agent-card--support .hac-agent-card__icon-note {
    border-color: var(--brand-graphite, #252525);
  }

  .hac-agent-card__content {
    display: block;
    margin-top: 1.45rem;
  }

  .hac-agent-card__content h2 {
    max-width: 14ch;
    margin: 0;
    font-size: clamp(1.75rem, 3.5vw, 2.45rem);
    font-weight: 760;
    letter-spacing: -0.045em;
    line-height: 1.02;
  }

  .hac-agent-card__copy {
    display: block;
    max-width: 43ch;
    margin-top: 0.85rem;
    color: var(--brand-gray, #6b6b6b);
    font-size: clamp(0.98rem, 1.4vw, 1.06rem);
    line-height: 1.55;
  }

  .hac-agent-card--support .hac-agent-card__copy {
    color: #c9cac4;
  }

  .hac-agent-card__tags {
    display: flex;
    margin-top: 1.35rem;
    margin-bottom: 0;
    padding: 0;
    flex-wrap: wrap;
    gap: 0.45rem;
    list-style: none;
  }

  .hac-agent-card__tags > li {
    display: inline-flex;
    min-height: 1.85rem;
    padding: 0.34rem 0.65rem;
    align-items: center;
    border: 1px solid var(--brand-border, #dfe1da);
    border-radius: var(--radius-pill, 999px);
    background: rgb(255 255 255 / 0.58);
    color: var(--brand-graphite, #252525);
    font-size: 0.75rem;
    font-weight: 650;
  }

  .hac-agent-card--support .hac-agent-card__tags > li {
    border-color: #494949;
    background: rgb(255 255 255 / 0.04);
    color: #e8e9e4;
  }

  .hac-agent-card__cta {
    display: flex;
    min-height: 3.25rem;
    margin-top: auto;
    padding-top: 1.4rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-top: 1px solid var(--brand-border, #dfe1da);
    font-weight: 760;
  }

  .hac-agent-card--support .hac-agent-card__cta {
    border-color: #454545;
  }

  .hac-agent-card__arrow {
    display: inline-grid;
    width: 2.65rem;
    height: 2.65rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 50%;
    background: var(--brand-lime, #c9d600);
    color: var(--brand-black, #111111);
    opacity: 0.58;
    transform: translate(-0.3rem, 0.3rem);
    transition:
      opacity var(--motion-fast, 180ms) ease,
      transform var(--motion-standard, 240ms)
        cubic-bezier(0.2, 0.75, 0.25, 1);
  }

  .hac-agent-card:hover .hac-agent-card__arrow,
  .hac-agent-card__link:focus-visible .hac-agent-card__arrow {
    opacity: 1;
    transform: translate(0, 0);
  }

  @media (max-width: 40rem) {
    .hac-agent-card {
      min-height: 25.5rem;
    }

    .hac-agent-card__link {
      padding: 1.3rem;
    }

    .hac-agent-card__icon-stage {
      width: 3.8rem;
      height: 3.8rem;
      margin-top: 1.5rem;
    }

    .hac-agent-card__tags {
      margin-top: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hac-agent-card,
    .hac-agent-card__glow,
    .hac-agent-card__icon-stage,
    .hac-agent-card__icon,
    .hac-agent-card__arrow {
      transition-duration: 1ms;
    }

    .hac-agent-card {
      transform: none;
      will-change: auto;
    }
  }
`;
