import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { loadSnapshot, type Snapshot } from "./lib/snapshot";
import { Hero } from "./components/Hero";
import { CrudeChart } from "./components/CrudeChart";
import { PumpPriceCards } from "./components/PumpPriceCards";
import { WaterfallChart } from "./components/WaterfallChart";
import { RetailTrendChart } from "./components/RetailTrendChart";
import { FuelSupply } from "./components/FuelSupply";
import { NewsColumn } from "./components/NewsColumn";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { LastUpdated } from "./components/LastUpdated";
import { AboutPage } from "./components/AboutPage";
import "./styles/layout.css";

type View = "dashboard" | "about";

function readHashView(): View {
  return window.location.hash === "#/about" ? "about" : "dashboard";
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(readHashView);

  useEffect(() => {
    loadSnapshot().then(setSnapshot).catch((e) => setError(String(e)));

    const onHashChange = () => {
      setView(readHashView());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goToDashboard = () => {
    if (window.location.hash) {
      history.pushState("", document.title, window.location.pathname);
    }
    setView("dashboard");
    window.scrollTo(0, 0);
  };

  if (view === "about") {
    return <AboutPage onBack={goToDashboard} />;
  }

  if (error) {
    return (
      <main className="container">
        <p className="caption" style={{ color: "var(--down)", marginTop: 96 }}>
          error loading snapshot: {error}
        </p>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="container">
        <p className="caption" style={{ marginTop: 96 }}>
          loading bowser…
        </p>
      </main>
    );
  }

  // Diesel price for the hero — CardLink gives dollars/L; fall back to
  // the latest MBIE weekly retail if CardLink's scraper failed.
  const dieselHeroDollars =
    snapshot.nz_retail?.diesel.avg ??
    (snapshot.historical_retail.diesel.length > 0
      ? snapshot.historical_retail.diesel[
          snapshot.historical_retail.diesel.length - 1
        ].price / 100
      : 0);

  return (
    <>
      <div className="topbar">
        <header className="wordmark-bar container">
          <span className="wordmark">bowser</span>
          <Nav />
          <LastUpdated generatedAt={snapshot.generated_at} />
        </header>
      </div>
      <main>
        <div className="container">
          <Hero
            crude={snapshot.crude}
            fx={snapshot.fx}
            dieselDollars={dieselHeroDollars}
          />
        </div>

        <motion.section
          id="crude"
          className="container chart-section section-anchor"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="section-header">
            <p className="caption">
              brent + wti · 12-month futures · source:{" "}
              <a
                href="https://finance.yahoo.com/quote/BZ=F/"
                target="_blank"
                rel="noreferrer"
              >
                yahoo finance
              </a>
            </p>
            <h2>The global crude story, this year.</h2>
          </header>
          <CrudeChart crude={snapshot.crude} fx={snapshot.fx} />
        </motion.section>

        {snapshot.nz_retail && (
          <div id="pump" className="container section-anchor">
            <PumpPriceCards
              retail={snapshot.nz_retail}
              history={snapshot.historical_retail}
            />
          </div>
        )}

        <motion.section
          id="history"
          className="container chart-section section-anchor"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="section-header">
            <p className="caption">
              source:{" "}
              <a
                href="https://www.mbie.govt.nz/building-and-energy/energy-and-natural-resources/energy-statistics-and-modelling/energy-statistics/weekly-fuel-price-monitoring"
                target="_blank"
                rel="noreferrer"
              >
                mbie weekly fuel price monitoring
              </a>
              {" · 2016 → 2026"}
            </p>
            <h2>Ten years of pump prices.</h2>
          </header>
          <RetailTrendChart history={snapshot.historical_retail} />
        </motion.section>

        <div id="waterfall" className="waterfall-outer section-anchor">
          <WaterfallChart waterfall={snapshot.mbie_waterfall} />
        </div>

        {snapshot.fuel_stocks && (
          <div id="supply" className="container section-anchor">
            <FuelSupply stocks={snapshot.fuel_stocks} />
          </div>
        )}

        <div id="news" className="container section-anchor">
          <section className="news-grid">
            <NewsColumn
              title="From New Zealand."
              eyebrow={
                <>
                  nz fuel ·{" "}
                  <a
                    href="https://news.google.com/search?q=New+Zealand+fuel+price"
                    target="_blank"
                    rel="noreferrer"
                  >
                    google news
                  </a>
                </>
              }
              items={snapshot.news.nz}
            />
            <NewsColumn
              title="From the wider world."
              eyebrow={
                <>
                  global crude ·{" "}
                  <a
                    href="https://news.google.com/search?q=global+oil+price+crude"
                    target="_blank"
                    rel="noreferrer"
                  >
                    google news
                  </a>
                </>
              }
              items={snapshot.news.global}
            />
          </section>
        </div>

        <div className="container">
          <Footer />
        </div>
      </main>
    </>
  );
}
