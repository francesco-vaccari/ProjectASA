import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import { default as config } from "./config.js";
import { You, GameMap, ParcelsManager, AgentsManager } from "./dataStructures.js";
import { Astar, computeManhattanDistance, BFS } from "./functions.js";

const client = new DeliverooApi( config.host, config.token )

const parcelsManager = new ParcelsManager(client)
const you = new You(client)
const map = new GameMap(client)
const agentsManager = new AgentsManager(client)

function directionString () {
    if (directionIndex > 3)
        directionIndex = directionIndex % 4;
    return [ 'up', 'right', 'down', 'left' ][ directionIndex ];
}

var directionIndex = 0

setTimeout(async () => {
    while(true){
        await client.pickup()
        if (you.x % 1 == 0 && you.y % 1 == 0){
            let bestParcel = parcelsManager.getBestParcel()
            if (bestParcel !== undefined) {
                console.log("calculating path to parcel")

                let plan = BFS(you.x, you.y, bestParcel.x, bestParcel.y, map)

                while(plan.length > 0){
                    await client.pickup()
                    let move = plan.shift()
                    let res = false
                    while(!res){
                        res = await client.move(move)
                    }
                }
                
                let done = false
                while(!done){
                    await client.pickup()
                    if(you.x % 1 == 0 && you.y % 1 == 0){
                        let minDistance = 100000
                        let best_x = 0
                        let best_y = 0
                        for(let i = 0; i < map.n_cols; i++){
                            for(let j = 0; j < map.n_rows; j++){
                                if(map.matrix[i][j] == 2){
                                    let tempDist = computeManhattanDistance(i, j, you.x, you.y)
                                    if(tempDist < minDistance){
                                        minDistance = tempDist
                                        best_x = i
                                        best_y = j
                                    }
                                }
                            }
                        }

                        console.log('calculating path to border')
                        let plan = BFS(you.x, you.y, best_x, best_y, map)
                        console.log(plan)
                        while(plan.length > 0){
                            await client.pickup()
                            let move = plan.shift()
                            let res = false
                            while(!res){
                                res = await client.move(move)
                            }
                        }
                        await client.putdown()
                        done = true
                    }
                }
                
            } else {
                directionIndex += [0,1,3][ Math.floor(Math.random()*3) ];
                var status = await client.move( directionString() )
                if (!status) {
                    directionIndex += [2,1,3][ Math.floor(Math.random()*3) ];
                }
            }
        }
    }
}, 2000)


// look for a way to understand when the 'tile' api stops sending info
// so i can proceed as soon as possible with initialization