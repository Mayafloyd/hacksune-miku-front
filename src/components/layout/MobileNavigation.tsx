import { Menu, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface MobileNavigationItem {
  href: string;
  label: string;
}

interface MobileNavigationProps {
  currentPath: string;
  currentSearch: string;
  items: MobileNavigationItem[];
}

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileNavigation({
  currentPath,
  currentSearch,
  items,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentParams = new URLSearchParams(currentSearch);

  const isItemCurrent = (href: string) => {
    const [itemPath = href, itemSearch = ""] = href.split("?");
    if (itemPath !== currentPath) return false;

    const itemParams = new URLSearchParams(itemSearch);
    const matchesItemParams = Array.from(itemParams.entries()).every(
      ([key, value]) => currentParams.get(key) === value,
    );

    if (itemParams.size > 0) return matchesItemParams;

    const hasMoreSpecificMatch = items.some((candidate) => {
      const [candidatePath = candidate.href, candidateSearch = ""] =
        candidate.href.split("?");
      if (candidatePath !== currentPath || candidateSearch.length === 0) {
        return false;
      }

      return Array.from(new URLSearchParams(candidateSearch).entries()).every(
        ([key, value]) => currentParams.get(key) === value,
      );
    });

    return !hasMoreSpecificMatch;
  };

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      : [];
    focusableElements[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  return (
    <div className="hac-mobile-navigation">
      <button
        ref={triggerRef}
        className="hac-mobile-navigation__trigger"
        type="button"
        aria-label="Abrir menú principal"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        onClick={() => setIsOpen(true)}
      >
        <Menu aria-hidden="true" size={22} strokeWidth={2} />
      </button>

      {isOpen ? (
        <div className="hac-mobile-navigation__layer">
          <div
            className="hac-mobile-navigation__backdrop"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={dialogRef}
            id={dialogId}
            className="hac-mobile-navigation__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
          >
            <div className="hac-mobile-navigation__heading">
              <div>
                <span className="hac-mobile-navigation__eyebrow">
                  Navegación
                </span>
                <p id={`${dialogId}-title`}>¿Qué necesitas hoy?</p>
              </div>
              <button
                className="hac-mobile-navigation__close"
                type="button"
                aria-label="Cerrar menú principal"
                onClick={() => setIsOpen(false)}
              >
                <X aria-hidden="true" size={22} strokeWidth={2} />
              </button>
            </div>

            <nav aria-label="Navegación principal móvil">
              <ul className="hac-mobile-navigation__links">
                {items.map((item, index) => {
                  const isCurrent = isItemCurrent(item.href);

                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <a
                        href={item.href}
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => setIsOpen(false)}
                      >
                        <span aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="hac-mobile-navigation__account">
              <span className="hac-mobile-navigation__status">
                <span aria-hidden="true" />
                Sesión activa
              </span>
              <button type="button" aria-label="Abrir perfil">
                <UserRound aria-hidden="true" size={19} strokeWidth={2} />
                Perfil
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{mobileNavigationStyles}</style>
    </div>
  );
}

const mobileNavigationStyles = `
  .hac-mobile-navigation {
    display: none;
  }

  .hac-mobile-navigation__trigger,
  .hac-mobile-navigation__close {
    display: inline-grid;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    place-items: center;
    border: 1px solid var(--brand-border, #dfe1da);
    border-radius: var(--radius-control, 0.75rem);
    background: var(--brand-white, #ffffff);
    color: var(--brand-black, #111111);
    cursor: pointer;
  }

  .hac-mobile-navigation__trigger:hover,
  .hac-mobile-navigation__close:hover {
    border-color: var(--brand-gray, #6b6b6b);
    background: var(--brand-surface, #f6f7f2);
  }

  .hac-mobile-navigation__trigger:focus-visible,
  .hac-mobile-navigation__close:focus-visible,
  .hac-mobile-navigation__links a:focus-visible,
  .hac-mobile-navigation__account button:focus-visible {
    outline: 3px solid var(--brand-lime, #c9d600);
    outline-offset: 3px;
  }

  .hac-mobile-navigation__layer {
    position: fixed;
    z-index: 90;
    inset: 0;
  }

  .hac-mobile-navigation__backdrop {
    position: absolute;
    inset: 0;
    background: rgb(17 17 17 / 0.52);
    animation: hac-mobile-fade-in var(--motion-standard, 220ms) ease both;
  }

  .hac-mobile-navigation__dialog {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    width: min(88vw, 24rem);
    height: 100%;
    padding: 1.25rem;
    flex-direction: column;
    overflow-y: auto;
    background:
      linear-gradient(145deg, rgb(201 214 0 / 0.11), transparent 12rem),
      var(--brand-white, #ffffff);
    color: var(--brand-black, #111111);
    box-shadow: -1.5rem 0 4rem rgb(17 17 17 / 0.18);
    animation: hac-mobile-slide-in var(--motion-standard, 240ms)
      cubic-bezier(0.2, 0.75, 0.25, 1) both;
  }

  .hac-mobile-navigation__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--brand-border, #dfe1da);
  }

  .hac-mobile-navigation__eyebrow {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--brand-gray, #6b6b6b);
    font-size: 0.72rem;
    font-weight: 750;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .hac-mobile-navigation__heading p {
    margin: 0;
    font-size: clamp(1.25rem, 5vw, 1.6rem);
    font-weight: 750;
    line-height: 1.15;
  }

  .hac-mobile-navigation__links {
    display: grid;
    margin: 0;
    padding: 1.25rem 0;
    list-style: none;
  }

  .hac-mobile-navigation__links a {
    display: flex;
    min-height: 3.65rem;
    padding: 0.7rem 0.2rem;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid var(--brand-border, #dfe1da);
    color: var(--brand-black, #111111);
    font-size: 1.03rem;
    font-weight: 680;
    text-decoration: none;
  }

  .hac-mobile-navigation__links a > span {
    color: var(--brand-gray, #6b6b6b);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.08em;
  }

  .hac-mobile-navigation__links a[aria-current="page"] {
    color: var(--brand-black, #111111);
  }

  .hac-mobile-navigation__links a[aria-current="page"]::after {
    width: 0.55rem;
    height: 0.55rem;
    margin-left: auto;
    border-radius: 50%;
    background: var(--brand-lime, #c9d600);
    content: "";
  }

  .hac-mobile-navigation__account {
    display: flex;
    margin-top: auto;
    padding-top: 1.25rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-top: 1px solid var(--brand-border, #dfe1da);
  }

  .hac-mobile-navigation__status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--brand-gray, #6b6b6b);
    font-size: 0.84rem;
    font-weight: 650;
  }

  .hac-mobile-navigation__status > span {
    width: 0.48rem;
    height: 0.48rem;
    border-radius: 50%;
    background: var(--brand-success, #287a3d);
    box-shadow: 0 0 0 0.22rem rgb(40 122 61 / 0.12);
  }

  .hac-mobile-navigation__account button {
    display: inline-flex;
    min-height: 2.75rem;
    padding: 0.65rem 0.85rem;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--brand-border, #dfe1da);
    border-radius: var(--radius-pill, 999px);
    background: var(--brand-white, #ffffff);
    color: var(--brand-black, #111111);
    font: inherit;
    font-size: 0.88rem;
    font-weight: 700;
  }

  @keyframes hac-mobile-fade-in {
    from { opacity: 0; }
  }

  @keyframes hac-mobile-slide-in {
    from {
      opacity: 0;
      transform: translateX(2rem);
    }
  }

  @media (max-width: 52.5rem) {
    .hac-mobile-navigation {
      display: block;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hac-mobile-navigation__backdrop,
    .hac-mobile-navigation__dialog {
      animation-duration: 1ms;
    }
  }
`;
