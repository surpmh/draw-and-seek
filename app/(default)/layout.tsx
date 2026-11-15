import { SiteDocument, siteViewport } from "@/components/SiteDocument";
import { pageMetadata, siteMetadata } from "@/lib/seo";

export const metadata = { ...siteMetadata, ...pageMetadata("ko") };
export const viewport = siteViewport;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <SiteDocument lang="ko">{children}</SiteDocument>;
}
