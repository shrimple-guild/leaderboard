import { fetchBeaconByTime, HttpChainClient, HttpCachingChain } from "drand-client"

const chainHash = "8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce"
const publicKey = "868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31"

const options = {
  disableBeaconVerification: false,
  noCache: false,
  chainVerificationParams: { chainHash, publicKey },
}

const chain = new HttpCachingChain("https://api.drand.sh", options)
const client = new HttpChainClient(chain, options)

export async function pickRandom<T>(arr: T[], time?: number): Promise<T> {
  const r = await fetchBeaconByTime(client, time ?? Date.now())
  const bitsNeeded = Math.ceil(Math.log2(arr.length))
  const randomData = r.randomness.split("").flatMap(i => parseInt(i, 16).toString(2).padStart(4, "0").split(""))
  while (randomData.length > bitsNeeded) {
    const num = parseInt(randomData.splice(0, bitsNeeded).join(""), 2)
    if (num < arr.length) return arr[num]
  }
  throw new Error("Unable to generate random number. Weird!")
}

const randomCrop = await pickRandom(
  [
    "Wheat Collection",
    "Carrot Collection",
    "Potato Collection",
    "Pumpkin Collection",
    "Melon Collection",
    "Cocoa Bean Collection",
    "Nether Wart Collection",
  ],
  1693713600000
)
