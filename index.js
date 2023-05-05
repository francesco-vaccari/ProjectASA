import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config.js"
const client = new DeliverooApi( config.host, config.token )

import { You, GameMap, ParcelsManager, AgentsManager } from "./beliefs.js";
import { Planner } from "./planner.js";

var plan = []
let control = {
    ready: true,
    lastAction: undefined
}

const agent = new You(client, false)
const map = new GameMap(client, true)
const parcelsManager = new ParcelsManager(client, false)
const agentsManager = new AgentsManager(client, false)
const planner = new Planner(map, agentsManager, parcelsManager, agent, control, false)

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



// BDI ARCHITECTURE

// BDI:
//  - belief/knowledge
//  - desire: current more complex goal (or just intention)
//  - intention: current plan to achieve the desire (or just plan)

// The idea is to have the agent to always perform the first action in the plan which is an array.
// Asynchronously the plan is being recomputed non stop, so that the agent can always have a plan to follow.
// The plan is recomputed based on the current beliefs which are also asynchronously updated.

