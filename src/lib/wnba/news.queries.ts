import { queryOptions } from "@tanstack/react-query";
import { fetchWnbaNews } from "./news.server";

export const wnbaNewsQueryOptions = () =>
  queryOptions({
    queryKey: ["wnba", "news"],
    queryFn: () => fetchWnbaNews(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes - news doesn't change frequently
  });
