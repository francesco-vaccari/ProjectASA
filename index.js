import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config.js"
import { You, GameMap, Parcels, Agents } from "./beliefs.js";
import { Planner } from "./planner.js";

const client = new DeliverooApi( config.host, config.token )
const conf = {
    AGENTS_OBSERVATION_DISTANCE: undefined,
    PARCELS_OBSERVATION_DISTANCE: undefined,
    PARCEL_DECADING_INTERVAL: undefined,
}
client.onConfig(data => {
    conf.AGENTS_OBSERVATION_DISTANCE = data.AGENTS_OBSERVATION_DISTANCE
    conf.PARCELS_OBSERVATION_DISTANCE = data.PARCELS_OBSERVATION_DISTANCE
    conf.PARCEL_DECADING_INTERVAL = data.PARCEL_DECADING_INTERVAL
})

const agent = new You(client, false)
const map = new GameMap(client, false)
const parcels = new Parcels(client, false)
const agents = new Agents(client, false)

while(!map.isReady){
    await new Promise(res => setImmediate(res))
}

const planner = new Planner(map, agents, parcels, agent, false)



var plan = []
var lastAction = undefined
var ready = true

async function agentControlLoop(){
    while(true){
        plan = planner.getPlan()
        if(ready && plan.length > 0){
            // console.log('READY')
            ready = false
            lastAction = plan[0]
            // console.log('\tACTION ' + lastAction)
            
            switch (lastAction) {
                case 'up':
                case 'down':
                case 'left':
                case 'right':
                    client.move(lastAction).then((res) => {
                        // console.log('\tRESULT ' + res)
                        ready = true
                        parcels.updateUncertainty()
                    })
                    break;
                case 'pickup':
                    await client.pickup().then(() => {
                        // console.log('\tDONE')
                        ready = true
                    })
                    break;
                case 'putdown':
                    await client.putdown().then(() => {
                        // console.log('\tDONE')
                        ready = true
                        parcels.clearPutdownParcels(agent.id)
                    })
                    break;
                default:
                    // console.log('ERROR')
                    ready = true
                    break;
            }

            plan.shift()
        }
        await new Promise(res => setImmediate(res))
    }
}

agentControlLoop()

