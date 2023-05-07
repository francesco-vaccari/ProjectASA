import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config.js"
const client = new DeliverooApi( config.host, config.token )

import { You, GameMap, Parcels, Agents } from "./beliefs.js";
import { Planner } from "./planner.js";

var plan = []
let control = {
    ready: true,
    lastAction: undefined
}

const agent = new You(client, false)
const map = new GameMap(client, true)
const parcels = new Parcels(client, false)
const agents = new Agents(client, false)
const planner = new Planner(map, agents, parcels, agent, control, false)

function agentControlLoop(){
    setTimeout(async () => {
        while(true){
            plan = planner.getPlan()
            if(control.ready && plan.length > 0){
                // console.log('READY')
                control.ready = false
                control.lastAction = plan[0]
                // console.log('\tACTION ' + control.lastAction)
                
                switch (control.lastAction) {
                    case 'up':
                    case 'down':
                    case 'left':
                    case 'right':
                        client.move(control.lastAction).then((res) => {
                            // console.log('\tRESULT ' + res)
                            control.ready = true
                            parcels.updateUncertainty()
                        })
                        break;
                    case 'pickup':
                        await client.pickup().then(() => {
                            // console.log('\tDONE')
                            control.ready = true
                        })
                        break;
                    case 'putdown':
                        await client.putdown().then(() => {
                            // console.log('\tDONE')
                            control.ready = true
                            parcels.clearPutdownParcels(agent.id)
                        })
                        break;
                    default:
                        // console.log('ERROR')
                        control.ready = true
                        break;
                }

                plan.shift()
            }
            await new Promise(res => setImmediate(res))
        }
    }, 1000)
}

agentControlLoop()
