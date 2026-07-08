import { useEffect, useState } from "react";
import { getRoute, onRouteChange, type Route } from "./router";
import { Workspace } from "./ui/Workspace";
import { SharedViewer } from "./ui/SharedViewer";

export function App() {
  const [route, setRoute] = useState<Route>(getRoute());

  useEffect(() => onRouteChange(setRoute), []);

  if (route.kind === "shared") {
    return <SharedViewer gistId={route.gistId} />;
  }
  return <Workspace route={route} />;
}
