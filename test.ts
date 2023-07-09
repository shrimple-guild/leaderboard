import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import { API } from "./API.js"

const hypixel = new API(config.apiKey, metrics)
const res = await hypixel.fetchProfiles("59998433ceda41c1b0acffe7d9b33594")
console.log(JSON.stringify(res, null, 4))