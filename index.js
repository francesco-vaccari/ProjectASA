import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config.js"
import { Conf, You, Parcels, GameMap, Agents } from "./beliefs.js"
import { Planner } from "./planner.js"

const control = {
    ready: true
}

// Next all the belief sets and the information about the environment is initialized
// Changing the values in the classes intialization from false to true will enable the verbose mode of that class
const client = new DeliverooApi( config.host, config.token )
const conf = new Conf(client, false)
const agent = new You(client, false)
const parcels = new Parcels(client, conf, agent, false)
const map = new GameMap(client, conf, agent, false)
const agents = new Agents(client, false)
const planner = new Planner(client, map, agent, parcels, agents, control, true)


var plan = []
var action = undefined

// Main control loop, gets the plan from the planner and executes it
async function agentControlLoop(){
    while(true){
        plan = planner.getPlan()
        if(control.ready && plan.length > 0){ // if the player is ready to make a move and there is a plan
            control.ready = false
            action = plan[0] // get first action in the plan
            switch (action) { // execute action
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
            plan.shift() // remove action from plan
        }
        await new Promise(res => setImmediate(res))
    }
}

agentControlLoop()