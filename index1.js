import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config1.js"
import { Conf, You, Parcels, GameMap, Agents } from "./beliefs.js"
import { Planner } from "./planner.js"
import { Communication } from "./communication.js"

const client = new DeliverooApi( config.host, config.token )
const conf = new Conf(client, false)
const agent = new You(client, false)
const parcels = new Parcels(client, conf, agent, false)
const map = new GameMap(client, conf, agent, false)
const agents = new Agents(client, false)
const planner = new Planner(client, map, agent, parcels, agents, false)
const comm = new Communication(client, agent, 'one', true)

