import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config1.js"
import { Conf, You, ThisAgentParcels, OtherAgentParcels, GameMap, OtherAgent, ThisAgentAgents, OtherAgentAgents, Parcels, Agents, Enemies } from "./beliefs.js"
import { Planner } from "./planner.js"
import { Communication, CommunicationHandler } from "./communication.js"

var control = {
    ready: true
}

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
const enemies = new Enemies(client, agent, otherAgent, agents, false)
const planner = new Planner(client, map, agent, otherAgent, parcels, agents, comm, enemies, 'one', control, true)
const commHandler = new CommunicationHandler(comm, agent, otherAgent, map, thisAgentParcels, otherAgentParcels, thisAgentAgents, otherAgentAgents, planner, false)

var plan = []
var action = undefined


async function agentControlLoop(){
    while(true){
        // plan = planner.getPlan()
        plan = planner.getPddlPlan()
        if(control.ready && plan.length > 0){
            control.ready = false
            action = plan[0]
            switch (action) {
                case 'up':
                case 'down':
                case 'left':
                case 'right':
                    client.move(action).then((res) => {
                        control.ready = true
                    })
                    break;
                case 'pickup':
                    await client.pickup().then(() => {
                        control.ready = true
                    })
                    break;
                case 'putdown':
                    await client.putdown().then(() => {
                        control.ready = true
                    })
                    break;
                default:
                    control.ready = true
                    break;
            }
            plan.shift()
        }
        await new Promise(res => setImmediate(res))
    }
}

agentControlLoop()