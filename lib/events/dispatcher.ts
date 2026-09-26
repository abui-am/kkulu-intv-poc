import { EVENT_LOG_LIMIT, type SessionEvent } from "@/lib/events/types";
import { reduceWorld } from "@/lib/world/reducer";
import type { WorldModel } from "@/lib/world/types";

export type SessionLog = {
  world: WorldModel;
  events: SessionEvent[];
};

export function dispatch(log: SessionLog, event: SessionEvent): SessionLog {
  const events = [...log.events, event];
  return {
    world: reduceWorld(log.world, event),
    events: events.length > EVENT_LOG_LIMIT ? events.slice(events.length - EVENT_LOG_LIMIT) : events,
  };
}
