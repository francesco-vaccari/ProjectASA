import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client"
import { default as config } from "./config1.js"
const client = new DeliverooApi( config.host, config.token )


let otherAgentId = undefined

client.onAgentsSensing(data => {
    for(const agent of data){
        if(agent.name === 'agent2'){
            otherAgentId = agent.id
        }
    }
})


// setInterval(() => {
//     if(otherAgentId !== undefined){
//         client.say(otherAgentId, "ciao")
//     }
// }, 2000)

setInterval(() => {
    client.shout("ciao a tutti")
}, 2000)