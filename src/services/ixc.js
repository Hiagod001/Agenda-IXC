const axios = require("axios");

// Configuração da API IXC (mantém defaults do projeto original)
let ixcApi = null;
const ixcConfig = {
  apiUrl: "https://sistema.uaitelecom.com.br/webservice/v1",
  apiToken: "442:92e76ec9743aee86b39af5199c7f199a0996f1679207c561f901f491c1653d1e",
};

// Função para inicializar a API IXC
function initializeIxcApi() {
  if (ixcConfig.apiToken && ixcConfig.apiUrl) {
    const basicAuthToken = Buffer.from(ixcConfig.apiToken).toString("base64");
    ixcApi = axios.create({
      baseURL: ixcConfig.apiUrl,
      headers: {
        Authorization: `Basic ${basicAuthToken}`,
        "Content-Type": "application/json",
        ixcsoft: "listar", // manter compatibilidade com o IXC
      },
      timeout: 20000,
    });
    console.log("API IXC inicializada com sucesso");
  } else {
    ixcApi = null;
    console.log("API IXC não configurada");
  }
}

function getIxcApi() {
  return ixcApi;
}

function getIxcConfig() {
  return { ...ixcConfig };
}

function setIxcConfig({ apiUrl, apiToken }) {
  if (typeof apiUrl === "string") ixcConfig.apiUrl = apiUrl;
  if (typeof apiToken === "string") ixcConfig.apiToken = apiToken;
  initializeIxcApi();
}

module.exports = { initializeIxcApi, getIxcApi, ixcConfig, getIxcConfig, setIxcConfig };
