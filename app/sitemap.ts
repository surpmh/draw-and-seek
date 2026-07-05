import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://drawandseek.com",
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://drawandseek.com/history",
      changeFrequency: "daily",
      priority: 0.5,
    },
  ];
}
