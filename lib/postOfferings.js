const { getPublicKey, relayInit } = require("nostr-tools");
const { getServicePrice } = require('./service');
const { createOfferingNote } = require("./nostr");
const {
  YTDL_RESULT_SCHEMA,
  YTDL_SCHEMA
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

  const ytdlPrice = await getServicePrice("YTDL")

  const ytdlOffering = createOfferingNote(
    pk,
    sk,
    "https://ytdl.com/",
    Number(ytdlPrice),
    process.env.ENDPOINT + "/" + "YTDL",
    "UP",
    YTDL_SCHEMA,
    YTDL_RESULT_SCHEMA,
    "Get a temporary link to any youtube video!"
  );

  await relay.publish(ytdlOffering);
  console.log(`Published YTDL Offering: ${ytdlOffering.id} to endpoint: ${process.env.ENDPOINT}`);

  relay.close();
}

module.exports = { postOfferings };