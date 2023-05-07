import { ManhattanDistance, PathLengthBFS } from "./util.js";

function normalCellHeuristic(x, y, map, agent, parcels, agents){
    let minDistanceToBorder = 10000000
    let borderx = undefined
    let bordery = undefined
    for (let i = 0; i < map.n_rows; i++){
        for(let j = 0; j < map.n_cols; j++){
            if(map.matrix[i][j] === 2){
                let tempDist = ManhattanDistance(x, y, i, j)
                if(tempDist < minDistanceToBorder){
                    minDistanceToBorder = tempDist
                    borderx = i
                    bordery = j
                }
            }
        }
    }

    let parcelsRewardInCell = 0
    for (const parcel of parcels.getMap()){
        if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
            parcelsRewardInCell += parcel[1].reward
        }
    }

    let distanceToAgent = 1
    if(parcelsRewardInCell != 0){
        distanceToAgent =  Math.max(PathLengthBFS(x, y, agent.x, agent.y, map, agents), 0.1)
    }

    let enemiesProximity = 1
    if(agents.getMap().size > 0){
        for (const agent of agents.getMap()){
            let tmp = ManhattanDistance(x, y, agent[1].x, agent[1].y) + 1
            tmp = - (1 / tmp) + 1
            if(tmp < enemiesProximity){
                enemiesProximity = tmp
            }
        }
    }

    return (Math.pow(parcelsRewardInCell, 1.2) / Math.pow(distanceToAgent, 1) + (minDistanceToBorder / ((Math.random() * 5)+1))/1000) * Math.pow(enemiesProximity, 2)
}

function deliveryCellHeuristic(x, y, map, agent, parcels, agents){
    let scoreParcelsCarriedByAgent = 0
    for (const parcel of parcels.getMap()){
        if(parcel[1].carriedBy == agent.id){
            scoreParcelsCarriedByAgent += parcel[1].reward
        }
    }

    let distanceToAgent = 1
    if(scoreParcelsCarriedByAgent != 0){
        distanceToAgent = Math.max(PathLengthBFS(x, y, agent.x, agent.y, map, agents), 0.1)
        // distanceToAgent = Math.max(ManhattanDistance(x, y, agent.x, agent.y), 0.1)
    }

    return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
}

export { normalCellHeuristic, deliveryCellHeuristic }