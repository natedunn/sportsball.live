import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Check if an image is cached and not expired
export const getCachedImage = internalQuery({
  args: { originalUrl: v.string() },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("cachedImages")
      .withIndex("by_originalUrl", (q) => q.eq("originalUrl", args.originalUrl))
      .first();

    if (!cached) return null;

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      return null;
    }

    return cached;
  },
});

// Store a new cached image reference
export const storeCachedImage = internalMutation({
  args: {
    originalUrl: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    ttlDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ttlDays = args.ttlDays ?? 7;
    const now = Date.now();
    const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000;

    // Check if already exists (race condition protection)
    const existing = await ctx.db
      .query("cachedImages")
      .withIndex("by_originalUrl", (q) => q.eq("originalUrl", args.originalUrl))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        contentType: args.contentType,
        cachedAt: now,
        expiresAt,
      });
      return existing._id;
    }

    // Create new record
    return await ctx.db.insert("cachedImages", {
      originalUrl: args.originalUrl,
      storageId: args.storageId,
      contentType: args.contentType,
      cachedAt: now,
      expiresAt,
    });
  },
});

// Delete expired cache entries (can be called periodically)
export const cleanupExpiredImages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("cachedImages")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const image of expired) {
      // Delete the stored file
      await ctx.storage.delete(image.storageId);
      // Delete the cache record
      await ctx.db.delete(image._id);
    }

    return { deleted: expired.length };
  },
});
