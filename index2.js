import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config2.js"
import { Conf, You, ThisAgentParcels, OtherAgentParcels, GameMap, OtherAgent, ThisAgentAgents, OtherAgentAgents, Parcels, Agents, Enemies } from "./beliefs.js"
import { Planner } from "./planner.js"
import { Communication, CommunicationHandler } from "./communication.js"

const control = {
    action: undefined,
    ready: true
}
const client = new DeliverooApi( config.host, config.token )
const conf = new Conf(client, false)
const comm = new Communication(client, 'two', false)
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
const planner = new Planner(client, map, agent, otherAgent, parcels, agents, comm, enemies, 'two', control, true)
const commHandler = new CommunicationHandler(comm, agent, otherAgent, map, thisAgentParcels, otherAgentParcels, thisAgentAgents, otherAgentAgents, planner, false)

var plan = []

async function agentControlLoop(){

    let newParcel, parcel, iterator, putdown;

    while(true){
        plan = planner.getPlan()
        if(control.ready && plan.length > 0){
            control.ready = false
            control.action = plan[0]

            /*newParcel = false
            putdown = false
            if (control.action == 'up' || control.action == 'down' || control.action == 'left' || control.action == 'right') {
                iterator = parcels.parcels.values()
                while (!newParcel && (parcel = iterator.next().value) != null) {
                    if (parcel.carriedBy == null && parcel.x == agent.x && parcel.y == agent.y) {
                        newParcel = true
                        control.lastAction = "pickup"
                        console.log("2 Ciao");
                    }
                    await new Promise(res => setImmediate(res))
                }
                iterator = parcels.parcels.values()
                if (map.getMatrix()[agent.x][agent.y].type == 2) {
                    while (!putdown && (parcel = iterator.next().value) != null) {
                        if (parcel.carriedBy == agent.id) {
                            putdown = true
                            control.lastAction = "putdown"
                            console.log("2 Ciaone");
                        }
                        await new Promise(res => setImmediate(res))
                    }
                }
            }*/

            switch (control.action) {
                case 'up':
                case 'down':
                case 'left':
                case 'right':
                    client.move(control.action).then((res) => {
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
            
            //if (!(newParcel || putdown)) {
            plan.shift()
            //}
        }
        await new Promise(res => setImmediate(res))
    }
}

agentControlLoop()