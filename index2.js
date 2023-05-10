import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config2.js"
const client = new DeliverooApi( config.host, config.token )

client.onMsg((fromId, fromName, msg) => {
    console.log(fromId, fromName, msg)
})