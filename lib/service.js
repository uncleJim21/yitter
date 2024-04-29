const { usd_to_millisats, sleep } = require("./common");
const { getBitcoinPrice } = require("./bitcoinPrice");
const axios  = require('axios');
const {
  STABLE_DIFFUSION_SCHEMA
} = require('../const/serviceSchema');

function sanitizeData(data, schema) {
  if (schema.type === "object" && schema.properties) {
      const newObj = {};
      for (const key in schema.properties) {
          if (data.hasOwnProperty(key)) {
              newObj[key] = sanitizeData(data[key], schema.properties[key]);
          }
      }
      return newObj;
  } else if (schema.type === "array" && schema.items) {
      if (Array.isArray(data)) {
          return data.map(item => sanitizeData(item, schema.items));
      }
      return [];
  } else {
      return data;
  }
}

async function getServicePrice(service) {
  const bitcoinPrice = await getBitcoinPrice(); 
  
  switch (service) {
    case "STABLE":
      return usd_to_millisats(process.env.STABLE_DIFFUSION_USD,bitcoinPrice);
    default:
      return usd_to_millisats(process.env.STABLE_DIFFUSION_USD,bitcoinPrice);
  }
}

function submitService(service, data) {
  switch (service) {
    case "STABLE":
      return callStableDiffusion(data);
    default:
      return callStableDiffusion(data);
  }
}

async function callStableDiffusion(data) {
  const sanitizedData = sanitizeData(data, STABLE_DIFFUSION_SCHEMA);
  const newData = {
    ...sanitizedData,
    key: process.env.STABLE_DIFFUSION_API_KEY,
  };

  const config = {
    method: "post",
    url: "https://stablediffusionapi.com/api/v4/dreambooth",
    headers: {
      "Content-Type": "application/json",
    },
    data: newData,
  };

  const fetchConfig = {
    method: "post",
    url: "https://stablediffusionapi.com/api/v4/dreambooth/fetch",
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    const fetchID = response.data.id;
    
    if(response.data.status === "processing"){
      fetchConfig['data'] = JSON.stringify({
        "key": process.env.STABLE_DIFFUSION_API_KEY,
        "request_id": fetchID,
      })
      let isProcessing = true;
      while (isProcessing) {
        await sleep(3000);
        const response = await axios(fetchConfig);
        console.log(JSON.stringify(response.data, null, 2));
        if (response.data.status !== "processing"){
          isProcessing = false;
          return response.data;
        }
      }
    }

    // Return when no longer processing
    return response.data;
  } catch (e) {
    console.log(`ERROR: ${e.toString().substring(0, 50)}`);
    return e;
  }
}

module.exports = { submitService, getServicePrice };