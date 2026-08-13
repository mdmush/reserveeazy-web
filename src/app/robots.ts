import type { MetadataRoute } from "next";

// /login and /signup stay crawlable on purpose: a robots-disallowed URL can
// still be indexed URL-only, whereas crawling lets Google see their meta
// noindex (set as the root-layout default) and actually deindex them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/book/"],
        disallow: [
          "/dashboard/",
          "/admin/",
          "/onboarding/",
          "/embed/",
          "/embed-demo/",
          "/auth/",
        ],
      },
    ],
  };
}
