/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as editor from "../editor.js";
import type * as files from "../files.js";
import type * as follows from "../follows.js";
import type * as legistar from "../legistar.js";
import type * as locations from "../locations.js";
import type * as media from "../media.js";
import type * as metrics from "../metrics.js";
import type * as near from "../near.js";
import type * as sync from "../sync.js";
import type * as watcher from "../watcher.js";
import type * as week from "../week.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  editor: typeof editor;
  files: typeof files;
  follows: typeof follows;
  legistar: typeof legistar;
  locations: typeof locations;
  media: typeof media;
  metrics: typeof metrics;
  near: typeof near;
  sync: typeof sync;
  watcher: typeof watcher;
  week: typeof week;
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

export declare const components: {};
