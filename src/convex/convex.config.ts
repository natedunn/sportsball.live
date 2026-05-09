import { defineApp } from "convex/server";
import convexAuth from "./zen/component/convex.config";

const app = defineApp();
app.use(convexAuth);

export default app;
