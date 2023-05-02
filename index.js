import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config.js"
const client = new DeliverooApi( config.host, config.token )

import { You, GameMap, ParcelsManager, AgentsManager } from "./beliefs.js";
const agent = new You(client, false)
const map = new GameMap(client, false)
const parcelsManager = new ParcelsManager(client, false)
const agentsManager = new AgentsManager(client, false)


import { computeManhattanDistance, BFS } from "./util.js";



var plan = ['up', 'left', 'down', 'pickup', 'putdown', 'right', 'left', 'down', 'up', 'pickup', 'left', 'right', 'down', 'putdown', 'right', 'left', 'down', 'up', 'up', 'down']
var lastAction = undefined
var ready = true

console.log(plan)

function agentControlLoop(){
    setTimeout(async () => {
        setInterval(async () => {
            if(ready && plan.length > 0){
                console.log('READY')
                ready = false
                lastAction = plan[0]
                console.log('\tACTION ' + lastAction)
                
                switch (lastAction) {
                    case 'up':
                    case 'down':
                    case 'left':
                    case 'right':
                        client.move(lastAction).then((res) => {
                            console.log('\tRESULT ' + res)
                            ready = true
                        })
                        break;
                    case 'pickup':
                        await client.pickup().then(() => {
                            console.log('\tDONE')
                            ready = true
                        })
                        break;
                    case 'putdown':
                        await client.putdown().then(() => {
                            console.log('\tDONE')
                            ready = true
                        })
                        break;
                    default:
                        console.log('ERROR')
                        ready = true
                        break;
                }
                plan.shift()
            }
        }, 1)
    }, 1000)
}

// ora bisogna solo scrivere il codice che va a calcolare il plan continuamente e l'agente semplicemente esegue

agentControlLoop()



// BDI ARCHITECTURE

// BDI:
//  - belief/knowledge
//  - desire: current more complex goal (or just intention)
//  - intention: current plan to achieve the desire (or just plan)

// The idea is to have the agent to always perform the first action in the plan which is an array.
// Asynchronously the plan is being recomputed non stop, so that the agent can always have a plan to follow.
// The plan is recomputed based on the current beliefs which are also asynchronously updated.

