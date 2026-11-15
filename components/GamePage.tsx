import HiddenCanvasApp from "./HiddenCanvasApp";
import { PAGE_COPY, gameStructuredData } from "@/lib/seo";
import type { Lang } from "@/lib/locales";

export function GamePage({ lang }: { lang: Lang }) {
  const copy = PAGE_COPY[lang];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameStructuredData(lang)).replace(/</g, "\\u003c") }} />
      <HiddenCanvasApp
        loadingLabel={copy.loading}
        introduction={
          <section className="game-introduction">
            <h2>{copy.heading}</h2>
            <p>{copy.description}</p>
          </section>
        }
      />
    </>
  );
}
