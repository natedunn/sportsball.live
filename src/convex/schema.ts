import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// League types supported by the app
const leagueValidator = v.union(
  v.literal("nba"),
  v.literal("wnba"),
  v.literal("gleague")
);

export default defineSchema({
  // Season configuration for each league
  seasons: defineTable({
    league: leagueValidator,
    name: v.string(), // e.g., "2024-25"
    startDate: v.string(), // ISO date string YYYY-MM-DD
    endDate: v.string(), // ISO date string YYYY-MM-DD
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_league", ["league"])
    .index("by_league_active", ["league", "isActive"]),

  // Cached images from external CDN
  cachedImages: defineTable({
    originalUrl: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    cachedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_originalUrl", ["originalUrl"]),

  // Users table for Better Auth
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  // Sessions for Better Auth
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),

  // OAuth accounts
  accounts: defineTable({
    userId: v.id("users"),
    providerId: v.string(),
    accountId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    idToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_provider_accountId", ["providerId", "accountId"]),
});
