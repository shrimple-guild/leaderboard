import {
  fetchBeacon, 
  fetchBeaconByTime, 
  HttpChainClient, 
  watch, 
  HttpCachingChain,
} from "drand-client"

const chainHash = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce'
const publicKey = '868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31' 

const options = {
  disableBeaconVerification: false, // `true` disables checking of signatures on beacons - faster but insecure!!!
  noCache: false, // `true` disables caching when retrieving beacons for some providers
  chainVerificationParams: { chainHash, publicKey }  // these are optional, but recommended! They are compared for parity against the `/info` output of a given node
}

// if you want to connect to a single chain to grab the latest beacon you can simply do the following
const chain = new HttpCachingChain('https://api.drand.sh', options)
const client = new HttpChainClient(chain, options)


export async function getRandomIndex(time: number, length: number) {
  const r = await fetchBeacon(client, 2851823)
  console.log(r.round)
  console.log(r.randomness)
  const randomness = BigInt(`0x${r.randomness}`)
  console.log(randomness)

  const base = randomness.toString(length)
  console.log(base)

  const index = base[base.length - 1]
  console.log(base)
  return parseInt(index, length)
}

console.log(await getRandomIndex(1, 5))