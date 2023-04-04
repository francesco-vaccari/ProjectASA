import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import { default as config } from "./config.js";
import { You, GameMap, ParcelsManager, AgentsManager } from "./dataStructures.js";
import { Astar } from "./functions.js";

const client = new DeliverooApi( config.host, config.token )

const parcelsManager = new ParcelsManager(client)
const you = new You(client)
const map = new GameMap(client)
const agentsManager = new AgentsManager(client)

setTimeout(async () => {
    while(true){
        await client.pickup()
        if (you.x % 1 == 0 && you.y % 1 == 0){
            console.log(parcelsManager.getBestParcel())
            let bestParcel = parcelsManager.getBestParcel()
            if (bestParcel !== undefined) {
                you.print()
                console.log(bestParcel.x, bestParcel.y)
                let path = Astar(you.x, you.y, bestParcel.x, bestParcel.y, map)
                console.log(path.length)
                let plan = []
                let lastx = you.x
                let lasty = you.y
                for (const cell of path) {
                    let move = ""
                    if(lastx < cell.x && lasty == cell.y) move = "right"
                    else if(lastx > cell.x && lasty == cell.y) move = "left"
                    else if(lasty < cell.y && lastx == cell.x) move = "up"
                    else if(lasty > cell.y && lastx == cell.x) move = "down"
                    lastx = cell.x
                    lasty = cell.y
                    plan.push(move)
                }
                console.log(plan)

                while(plan.length > 0){
                    let move = plan.shift()
                    let res = false
                    while(!res){
                        res = await client.move(move)
                    }
                }

                // consenga parcella
                
            }
        }
    }
}, 2000)


// compute minimum distance between current coord and deliverable cells (matrix value 2) and astar of that cell



// look for a way to understand when the 'tile' api stops sending info
// so i can proceed as soon as possible with initialization
// because in case of lower parcel decay or no parcel decay at all the initialization takes more time