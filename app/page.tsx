import HiddenCanvasApp from "@/components/HiddenCanvasApp";

// 검색엔진 크롤러가 읽는 초기 HTML용 콘텐츠. 화면에는 캔버스 앱만 보이지만,
// 앱 전체가 클라이언트 렌더라 크롤러가 텍스트를 못 읽으므로 서버에서 실제 콘텐츠를 심는다.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Draw & Seek",
  alternateName: "숨은그림찾기",
  url: "https://drawandseek.com",
  description:
    "온라인 숨은그림찾기 게임. 거대한 캔버스에 그림을 그려 숨기고, 다른 사람들이 숨긴 그림을 찾아보세요.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  inLanguage: "ko",
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
};

// 시각적으로 숨기되 스크린리더·크롤러에는 노출 (display:none 이 아니라 clip 방식이라 색인됨)
const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section style={srOnly}>
        <h1>숨은그림찾기 – Draw &amp; Seek</h1>
        <p>
          Draw &amp; Seek는 무료로 즐기는 온라인 숨은그림찾기 게임입니다. 거대한 공용 캔버스에
          직접 그림을 그려 몰래 숨기고, 다른 사람들이 곳곳에 숨겨둔 그림을 찾아보세요. 여러 사람이
          함께 그림을 그리고 찾는 협동 그림 게임으로, 오래 발견되지 않은 그림일수록 랭킹이
          올라갑니다. 설치나 회원가입 없이 웹 브라우저에서 바로 그림을 그리며 즐기는 온라인 그림판
          숨바꼭질 게임입니다.
        </p>
        <h2>게임 방법</h2>
        <ul>
          <li>그림을 그려 거대한 캔버스 속 원하는 위치에 숨깁니다.</li>
          <li>다른 사람이 숨긴 그림을 캔버스를 탐색하며 찾아냅니다.</li>
          <li>오래 숨겨진 그림일수록 높은 순위에 오릅니다.</li>
        </ul>
      </section>
      <HiddenCanvasApp />
    </>
  );
}
