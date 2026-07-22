export * from "./model.js";
export * from "./trip-planner.js";

import { TripRoutePlannerElement } from "./trip-planner.js";

export const registerTripRoutePlanner = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get("trip-route-planner")) {
    customElements.define("trip-route-planner", TripRoutePlannerElement);
  }
};

registerTripRoutePlanner();
