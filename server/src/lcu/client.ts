import axios, { AxiosInstance } from "axios";
import { Agent } from "node:https";
import { LcuCredentials } from "./credentials";

/**
 * Cria um cliente axios pronto para falar com a LCU.
 * A LCU usa um certificado autoassinado da Riot; como só falamos com
 * 127.0.0.1 (a própria máquina), aceitamos esse certificado.
 */
export function createLcuClient(creds: LcuCredentials): AxiosInstance {
  return axios.create({
    baseURL: creds.baseUrl,
    headers: { Authorization: creds.authHeader },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
  });
}
