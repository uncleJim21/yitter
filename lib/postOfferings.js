const { getPublicKey, relayInit } = require("nostr-tools");
const { getServicePrice } = require('./service');
const { createOfferingNote } = require("./nostr");
const {
  STABLE_DIFFUSION_RESULT_SCHEMA,
  STABLE_DIFFUSION_SCHEMA
} = require('../const/serviceSchema');

async function postOfferings() {
  const sk = process.env.NOSTR_SK;
  const pk = getPublicKey(sk);

  const relay = relayInit(process.env.NOSTR_RELAY);
  relay.on("connect", () => {
    console.log(`connected to ${relay.url}`);
  });
  relay.on("error", (e) => {
    console.log(`failed to connect to ${relay.url}: ${e}`);
  });
  await relay.connect();

  const stablePrice = await getServicePrice("STABLE")
  const sdOffering = createOfferingNote(
    pk,
    sk,
    "https://stablediffusionapi.com/api/v4/dreambooth",
    Number(stablePrice),
    process.env.ENDPOINT + "/" + "STABLE",
    "UP",
    STABLE_DIFFUSION_SCHEMA,
    STABLE_DIFFUSION_RESULT_SCHEMA,
    "Get your SD needs here!"
  );

  await relay.publish(sdOffering);
  console.log(`Published Stable Diffusion Offering: ${sdOffering.id}`);

  relay.close();
}

module.exports = { postOfferings };