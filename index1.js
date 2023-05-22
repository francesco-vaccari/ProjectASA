import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config1.js"
import { Conf, You, ThisAgentParcels, OtherAgentParcels, GameMap, OtherAgent, ThisAgentAgents, OtherAgentAgents, Parcels, Agents } from "./beliefs.js"
import { Planner } from "./planner.js"
import { Communication, CommunicationHandler } from "./communication.js"

const client = new DeliverooApi( config.host, config.token )
const conf = new Conf(client, false)
const comm = new Communication(client, 'one', false)
const agent = new You(client, comm, false)
const otherAgent = new OtherAgent(false)
const map = new GameMap(client, comm, conf, agent, false)
const parcels = new Parcels(conf, agent, otherAgent, false)
const agents = new Agents(conf, agent, otherAgent, false)
const thisAgentParcels = new ThisAgentParcels(client, parcels, conf, agent, comm, false)
const otherAgentParcels = new OtherAgentParcels(parcels, false)
const thisAgentAgents = new ThisAgentAgents(client, agents, comm, false)
const otherAgentAgents = new OtherAgentAgents(agents, false)
const planner = new Planner(client, map, agent, otherAgent, parcels, agents, comm, false)
const commHandler = new CommunicationHandler(comm, otherAgent, map, thisAgentParcels, otherAgentParcels, thisAgentAgents, otherAgentAgents, false)

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