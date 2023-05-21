import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config2.js"
import { Conf, You, Parcels, GameMap, Agents, OtherAgent } from "./beliefs.js"
import { Planner } from "./planner.js"
import { Communication, CommHandler } from "./communication.js"

const client = new DeliverooApi( config.host, config.token )
const conf = new Conf(client, false)
const comm = new Communication(client, 'two', false)
const agent = new You(client, comm, false)
const parcels = new Parcels(client, conf, agent, comm, false)
const map = new GameMap(client, comm, conf, agent, false)
const agents = new Agents(client, comm, false)
const planner = new Planner(client, map, agent, parcels, agents, comm, false)
const otherAgent = new OtherAgent(false)
const commHandler = new CommHandler(comm, otherAgent, map, parcels, agents, false)

var plan = []
var action = undefined
var ready = true

async function agentControlLoop(){
    while(true){
        plan = planner.getPlan()
        if(ready && plan.length > 0){
            ready = false
            action = plan[0]
            switch (action) {
                case 'up':
                case 'down':
                case 'left':
                case 'right':
                    client.move(action).then((res) => {
                        ready = true
                    })
                    break;
                case 'pickup':
                    await client.pickup().then(() => {
                        ready = true
                    })
                    break;
                case 'putdown':
                    await client.putdown().then(() => {
                        ready = true
                    })
                    break;
                default:
                    ready = true
                    break;
            }
            plan.shift()
        }
        await new Promise(res => setImmediate(res))
    }
}

agentControlLoop()