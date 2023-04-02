import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import { default as config } from "./config.js";
import { Agent, GameMap, ParcelsManager } from "./dataStructures.js";
import { } from "./functions.js";

const client = new DeliverooApi( config.host, config.token )

const parcelsManager = new ParcelsManager(client);
const agent = new Agent(client)
const map = new GameMap(client)

// add support for no parcel decay
// will have to look for what gives me that info

// look for a way to understand when the 'tile' api stops sending info
// so i can proceed as soon as possible with initialization
// because in case of lower parcel decay or no parcel decay at all the initialization takes more time
// because in case of lower parcel decay or no parcel decay at all the initialization takes more time