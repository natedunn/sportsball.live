/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as bootstrapAdmin from "../bootstrapAdmin.js";
import type * as crons from "../crons.js";
import type * as favorites from "../favorites.js";
import type * as gleague_actions from "../gleague/actions.js";
import type * as gleague_mutations from "../gleague/mutations.js";
import type * as gleague_queries from "../gleague/queries.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as nba_actions from "../nba/actions.js";
import type * as nba_mutations from "../nba/mutations.js";
import type * as nba_queries from "../nba/queries.js";
import type * as randomUsername from "../randomUsername.js";
import type * as seasons from "../seasons.js";
import type * as shared_apiParser from "../shared/apiParser.js";
import type * as shared_scoreboardSeries from "../shared/scoreboardSeries.js";
import type * as shared_seasonHelpers from "../shared/seasonHelpers.js";
import type * as shared_statsCalculations from "../shared/statsCalculations.js";
import type * as validators from "../validators.js";
import type * as wnba_actions from "../wnba/actions.js";
import type * as wnba_mutations from "../wnba/mutations.js";
import type * as wnba_queries from "../wnba/queries.js";
import type * as zen__generated_auth from "../zen/_generated/auth.js";
import type * as zen__generated_meta from "../zen/_generated/meta.js";
import type * as zen__generated_oauth from "../zen/_generated/oauth.js";
import type * as zen_core from "../zen/core.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  bootstrapAdmin: typeof bootstrapAdmin;
  crons: typeof crons;
  favorites: typeof favorites;
  "gleague/actions": typeof gleague_actions;
  "gleague/mutations": typeof gleague_mutations;
  "gleague/queries": typeof gleague_queries;
  http: typeof http;
  images: typeof images;
  "nba/actions": typeof nba_actions;
  "nba/mutations": typeof nba_mutations;
  "nba/queries": typeof nba_queries;
  randomUsername: typeof randomUsername;
  seasons: typeof seasons;
  "shared/apiParser": typeof shared_apiParser;
  "shared/scoreboardSeries": typeof shared_scoreboardSeries;
  "shared/seasonHelpers": typeof shared_seasonHelpers;
  "shared/statsCalculations": typeof shared_statsCalculations;
  validators: typeof validators;
  "wnba/actions": typeof wnba_actions;
  "wnba/mutations": typeof wnba_mutations;
  "wnba/queries": typeof wnba_queries;
  "zen/_generated/auth": typeof zen__generated_auth;
  "zen/_generated/meta": typeof zen__generated_meta;
  "zen/_generated/oauth": typeof zen__generated_oauth;
  "zen/core": typeof zen_core;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  zenComponent: import("../zen/component/_generated/component.js").ComponentApi<"zenComponent">;
};
