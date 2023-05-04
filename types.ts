import metric from "./metrics.json" assert { type: "json" }

export type Metric = {
  name: string,
  counter: string,
  path: string
}

export type Profile = {
  playerId: string,
  profileId: string,
  cuteName: string,
  metrics: { metric: string, value: number | undefined }[]
}