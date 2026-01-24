import * as z from "zod";

export const MarketEnumSchema = z.enum(["away", "home", "national"]);
export type MarketEnum = z.infer<typeof MarketEnumSchema>;

export const RecordTypeSchema = z.enum(["home", "road", "total"]);
export type RecordType = z.infer<typeof RecordTypeSchema>;

export const StateSchema = z.enum(["in", "pre", "post"]);
export type State = z.infer<typeof StateSchema>;

export const LinescoreSchema = z.object({
  value: z.number().optional(),
});
export type Linescore = z.infer<typeof LinescoreSchema>;

export const RecordSchema = z.object({
  name: z.string().optional(),
  abbreviation: z.string().optional(),
  type: RecordTypeSchema.optional(),
  summary: z.string().optional(),
});
export type Record = z.infer<typeof RecordSchema>;

export const TeamLinkSchema = z.object({
  rel: z.array(z.string()).optional(),
  href: z.string().optional(),
  text: z.string().optional(),
  isExternal: z.boolean().optional(),
  isPremium: z.boolean().optional(),
});
export type TeamLink = z.infer<typeof TeamLinkSchema>;

export const VenueClassSchema = z.object({
  id: z.string().optional(),
});
export type VenueClass = z.infer<typeof VenueClassSchema>;

export const CompetitorTeamSchema = z.object({
  id: z.string(),
  uid: z.string().optional(),
  location: z.string().optional(),
  name: z.string().optional(),
  abbreviation: z.string().optional(),
  displayName: z.string().optional(),
  shortDisplayName: z.string().optional(),
  color: z.string().optional(),
  alternateColor: z.string().optional(),
  isActive: z.boolean().optional(),
  venue: VenueClassSchema.optional(),
  links: z.array(TeamLinkSchema).optional(),
  logo: z.string().optional(),
});
export type CompetitorTeam = z.infer<typeof CompetitorTeamSchema>;

export const StatisticSchema = z.object({
  name: z.string().optional(),
  abbreviation: z.string().optional(),
  displayValue: z.string().optional(),
});
export type Statistic = z.infer<typeof StatisticSchema>;

export const LeaderLeaderSchema = z.object({
  displayValue: z.string().optional(),
  value: z.number().optional(),
  athlete: z.any().optional(),
  team: VenueClassSchema.optional(),
});
export type LeaderLeader = z.infer<typeof LeaderLeaderSchema>;

export const CompetitorLeaderSchema = z.object({
  name: z.string().optional(),
  displayName: z.string().optional(),
  shortDisplayName: z.string().optional(),
  abbreviation: z.string().optional(),
  leaders: z.array(LeaderLeaderSchema).optional(),
});
export type CompetitorLeader = z.infer<typeof CompetitorLeaderSchema>;

export const CompetitorSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  type: z.string().optional(),
  order: z.number().optional(),
  homeAway: MarketEnumSchema,
  team: CompetitorTeamSchema,
  score: z.string(),
  linescores: z.array(LinescoreSchema).optional(),
  statistics: z.array(StatisticSchema).optional(),
  leaders: z.array(CompetitorLeaderSchema).optional(),
  records: z.array(RecordSchema).optional(),
});
export type Competitor = z.infer<typeof CompetitorSchema>;

export const StatusTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  state: StateSchema,
  completed: z.boolean().optional(),
  description: z.string().optional(),
  detail: z.string().optional(),
  shortDetail: z.string().optional(),
});
export type StatusType = z.infer<typeof StatusTypeSchema>;

export const StatusSchema = z.object({
  clock: z.number().optional(),
  displayClock: z.string().optional(),
  period: z.number().optional(),
  type: StatusTypeSchema,
});
export type Status = z.infer<typeof StatusSchema>;

export const VenueSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().optional(),
  address: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  indoor: z.boolean().optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

export const CompetitionSchema = z.object({
  id: z.string().optional(),
  uid: z.string().optional(),
  date: z.string().optional(),
  attendance: z.number().optional(),
  type: z
    .object({
      id: z.string().optional(),
      abbreviation: z.string().optional(),
    })
    .optional(),
  timeValid: z.boolean().optional(),
  neutralSite: z.boolean().optional(),
  conferenceCompetition: z.boolean().optional(),
  playByPlayAvailable: z.boolean().optional(),
  recent: z.boolean().optional(),
  venue: VenueSchema.optional(),
  competitors: z.array(CompetitorSchema).min(2),
  notes: z.array(z.any()).optional(),
  situation: z.any().optional(),
  status: StatusSchema.optional(),
  broadcasts: z.array(z.any()).optional(),
  format: z.any().optional(),
  startDate: z.string().optional(),
  broadcast: z.string().optional(),
  geoBroadcasts: z.array(z.any()).optional(),
  highlights: z.array(z.any()).optional(),
  tickets: z.array(z.any()).optional(),
  odds: z.array(z.any()).optional(),
});
export type Competition = z.infer<typeof CompetitionSchema>;

export const EventSeasonSchema = z.object({
  year: z.number().optional(),
  type: z.number().optional(),
  slug: z.string().optional(),
});
export type EventSeason = z.infer<typeof EventSeasonSchema>;

export const EventLinkSchema = z.object({
  language: z.string().optional(),
  rel: z.array(z.string()).optional(),
  href: z.string().optional(),
  text: z.string().optional(),
  shortText: z.string().optional(),
  isExternal: z.boolean().optional(),
  isPremium: z.boolean().optional(),
});
export type EventLink = z.infer<typeof EventLinkSchema>;

export const EventSchema = z.object({
  id: z.string(),
  uid: z.string(),
  date: z.string().optional(),
  name: z.string().optional(),
  shortName: z.string().optional(),
  season: EventSeasonSchema.optional(),
  competitions: z.array(CompetitionSchema).min(1),
  links: z.array(EventLinkSchema).optional(),
  status: StatusSchema.optional(),
});
export type Event = z.infer<typeof EventSchema>;

export const NbaScoreboardResponseSchema = z.object({
  leagues: z.array(z.any()).optional(),
  season: z
    .object({
      type: z.number().optional(),
      year: z.number().optional(),
    })
    .optional(),
  day: z
    .object({
      date: z.string().optional(),
    })
    .optional(),
  events: z.array(EventSchema).optional(),
});
export type NbaScoreboardResponse = z.infer<typeof NbaScoreboardResponseSchema>;
