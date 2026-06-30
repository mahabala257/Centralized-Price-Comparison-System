const https = require("https");
const axios = require("axios");

// Force TLS 1.2 for all HTTPS requests
axios.defaults.httpsAgent = new https.Agent({
  secureProtocol: "TLSv1_2_method"
});