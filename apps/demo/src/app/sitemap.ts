import type { MetadataRoute } from "next";

import { docsPages } from "../lib/docs";
import { siteConfig } from "../lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/demo", ...docsPages.map((page) => page.href)];

  return routes.map((route) => ({
    url: `${siteConfig.siteUrl}${route}`,
    lastModified: new Date()
  }));
}
