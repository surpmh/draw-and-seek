import Script from "next/script";

/**
 * 방문자 분석은 배포 호스트와 무관하게 GA4를 사용한다.
 * GA4는 프로덕션 빌드에서만 로드된다(로컬 dev 방문은 집계 제외).
 * 측정 ID는 공개 값이라 코드에 둔다. NEXT_PUBLIC_GA_ID 로 덮어쓸 수 있음.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-0CY7CNB56H";

export function Analytics() {
  const enabled = process.env.NODE_ENV === "production";
  return (
    <>
      {enabled && GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
    </>
  );
}
