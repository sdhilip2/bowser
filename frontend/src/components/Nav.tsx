import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: "crude", label: "crude" },
  { id: "pump", label: "nz pump" },
  { id: "history", label: "history" },
  { id: "waterfall", label: "waterfall" },
  { id: "supply", label: "supply" },
  { id: "news", label: "news" },
];

export function Nav() {
  const [active, setActive] = useState<string>("crude");

  useEffect(() => {
    // A section counts as "active" when its top crosses the upper third
    // of the viewport. The rootMargin trims the intersection zone so we
    // don't flicker between sections at the seam — one clean hand-off.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onAboutClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser set the hash so the hashchange listener in App
    // flips the view. Scroll to top for the about-page transition.
    window.scrollTo(0, 0);
    // Fall through to default href behavior (#/about)
    void e;
  };

  return (
    <nav className="topnav" aria-label="section navigation">
      <a
        href="#/about"
        className="topnav-link topnav-about"
        onClick={onAboutClick}
      >
        about
      </a>
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`topnav-link ${active === s.id ? "topnav-active" : ""}`}
          onClick={(e) => onClick(e, s.id)}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
