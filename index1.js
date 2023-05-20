import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config1.js"
import { Conf, You, Parcels, GameMap, Agents } from "./beliefs.js"
import { Planner } from "./planner.js"

const client = new DeliverooApi( config.host, config.token )
const conf = new Conf(client, false)
const agent = new You(client, false)
const parcels = new Parcels(client, conf, agent, false)
const map = new GameMap(client, conf, agent, false)
const agents = new Agents(client, false)
const planner = new Planner(client, map, agent, parcels, agents, false)


const INIT = 'init'
const SECRET = 'secret'
const OKAY = 'okay'

let otherAgentId = undefined
initializeCommunication()


function initializeCommunication(){
    let interval = setInterval(() => {
        client.shout(INIT)
    }, 50)

    client.onMsg((fromId, fromName, msg) => {
        if(otherAgentId === undefined){
            if(msg === SECRET){
                clearInterval(interval)
                client.say(fromId, OKAY)
                otherAgentId = fromId
                console.log('['+agent.name+']\tCommunication initialized', otherAgentId)
            }
        }
    })
}


