import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Image proxy HTTP action with Convex storage caching
http.route({
  path: "/image",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }

    // Only allow configured CDN hosts
    const allowedHostsEnv = process.env.IMAGE_PROXY_ALLOWED_HOSTS || "";
    const allowedHosts = allowedHostsEnv.split(",").map((h) => h.trim()).filter(Boolean);
    try {
      const parsedUrl = new URL(imageUrl);
      if (!allowedHosts.includes(parsedUrl.host)) {
        return new Response("URL not allowed", { status: 403 });
      }
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    try {
      // Check if image is cached
      const cached = await ctx.runQuery(internal.images.getCachedImage, {
        originalUrl: imageUrl,
      });

      if (cached) {
        // Serve from Convex storage
        const storageUrl = await ctx.storage.getUrl(cached.storageId);
        if (storageUrl) {
          // Redirect to the storage URL for better caching
          return new Response(null, {
            status: 302,
            headers: {
              Location: storageUrl,
              "Cache-Control": "public, max-age=604800",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        // Storage URL not found, fall through to fetch
      }

      // Fetch from external CDN
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return new Response("Failed to fetch image", { status: 502 });
      }

      const contentType = imageResponse.headers.get("content-type") || "image/png";
      const imageData = await imageResponse.arrayBuffer();

      // Store in Convex storage
      const blob = new Blob([imageData], { type: contentType });
      const storageId = await ctx.storage.store(blob);

      // Save cache reference
      await ctx.runMutation(internal.images.storeCachedImage, {
        originalUrl: imageUrl,
        storageId,
        contentType,
      });

      // Return the image
      return new Response(imageData, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("Image proxy error:", error);
      return new Response("Failed to fetch image", { status: 502 });
    }
  }),
});

// CORS preflight
http.route({
  path: "/image",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;
