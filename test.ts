import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import { API } from "./API.js"

const hypixel = new API(config.apiKey, metrics)
const res = await hypixel.fetchProfiles("6e0560b84ae84b7bad8a4f9610060c00")
console.log(JSON.stringify(res, null, 4))

