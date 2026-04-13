export function Footer() {
  return (
    <footer className="footer">
      <hr className="hairline" />
      <div className="footer-grid">
        <div className="footer-col">
          <p className="caption">disclaimer</p>
          <p className="footer-body">
            Bowser is a personal project, not affiliated with or endorsed by
            the author's employer. All data is sourced from public APIs and
            government datasets — Yahoo Finance, MBIE, CardLink PriceWatch,
            Google News, ExchangeRate-API. The dashboard is built for
            informational and educational purposes only and should not be
            used as a basis for investment or trading decisions.
          </p>
        </div>
        <div className="footer-col footer-col-right">
          <p className="caption">built by</p>
          <p className="footer-body">Dhilip Subramanian</p>
          <p className="footer-body footer-socials">
            <a href="https://x.com/sdhilip" target="_blank" rel="noreferrer">
              X
            </a>
            {" · "}
            <a
              href="https://www.linkedin.com/in/dhilip-subramanian-36021918b/?skipRedirect=true"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          </p>
        </div>
      </div>
      <hr className="hairline" />
    </footer>
  );
}
