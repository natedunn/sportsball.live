import { createServerFn } from "@tanstack/react-start";
import type { GameData } from "@/lib/types";
import { fetchNbaGames } from "@/lib/nba/games.server";
import { fetchWnbaGames } from "@/lib/wnba/games.server";
import { fetchGLeagueGames } from "@/lib/gleague/games.server";
import type { League } from "@/lib/shared/league";

export interface LeagueGames {
  league: League;
  leagueLabel: string;
  games: GameData[];
}

export interface TodayGamesData {
  date: string;
  leagues: LeagueGames[];
  totalGames: number;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export const fetchTodayGames = createServerFn({ method: "GET" }).handler(
  async (): Promise<TodayGamesData> => {
    const date = getTodayDate();

    // Fetch all leagues in parallel
    const [nbaGames, wnbaGames, gleagueGames] = await Promise.all([
      fetchNbaGames({ data: date }).catch(() => [] as GameData[]),
      fetchWnbaGames({ data: date }).catch(() => [] as GameData[]),
      fetchGLeagueGames({ data: date }).catch(() => [] as GameData[]),
    ]);

    const leagues: LeagueGames[] = [];

    if (nbaGames.length > 0) {
      leagues.push({ league: "nba", leagueLabel: "NBA", games: nbaGames });
    }
    if (wnbaGames.length > 0) {
      leagues.push({ league: "wnba", leagueLabel: "WNBA", games: wnbaGames });
    }
    if (gleagueGames.length > 0) {
      leagues.push({
        league: "gleague",
        leagueLabel: "G League",
        games: gleagueGames,
      });
    }

    const totalGames =
      nbaGames.length + wnbaGames.length + gleagueGames.length;

    return {
      date,
      leagues,
      totalGames,
    };
  }
);
