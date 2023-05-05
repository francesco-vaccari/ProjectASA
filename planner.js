import { ManhattanDistance, BFS, PathLengthBFS } from "./util.js";
import chalk from "chalk"

class Planner{
    constructor(map, agentsManager, parcelsManager, agent, verbose=false){
        setTimeout(() => {
            this.n_rows = map.getRows()
            this.n_cols = map.getCols()
            this.map = []
            this.scoreMap = []
            this.verbose = verbose

            for (let i = 0; i < this.n_rows; i++){
                this.map.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.map[i].push(0)
                }
            }

            for (let i = 0; i < this.n_rows; i++){
                this.scoreMap.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.scoreMap[i].push(0)
                }
            }

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    this.map[i][j] = map.getMatrix()[i][j]
                }
            }

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    this.scoreMap[i][j] = 0
                }
            }

            if(this.verbose){
                console.log('ScoreMap initialized')
            }

            this.startPlanning(map, agentsManager, parcelsManager, agent)
            
            if(this.verbose){
                setInterval(() => {
                    this.print(agent)
                    // console.log(this.intention)
                    console.log(this.plan)
                }, 100)
            }
        }, 900)
    }

    normalCellHeuristic(x, y, map, agent, parcelsManager, agentsManager){
        let minDistanceToBorder = 10000000
        let borderx = undefined
        let bordery = undefined
        for (let i = 0; i < this.n_rows; i++){
            for(let j = 0; j < this.n_cols; j++){
                if(this.map[i][j] === 2){
                    // let tempDist = BFS(x, y, i, j, map, agentsManager).length
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
        for (const parcel of parcelsManager.parcels.elements){
            if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
                // if(parcel[1].x == agent.x && parcel[1].y == agent.y){
                //     parcelsRewardInCell += 1000000
                // }
                parcelsRewardInCell += parcel[1].reward
            }
        }
    
        let distanceToAgent = 1
        if(parcelsRewardInCell != 0){
            // distanceToAgent = ManhattanDistance(x, y, agent.x, agent.y)
            distanceToAgent =  Math.max(PathLengthBFS(x, y, agent.x, agent.y, map, agentsManager), 0.1)
        }
    
    
        // let enemiesProximity = 0
        // let enemiesProximityCoeff = 3
        // for (const agent of agentsManager.agents.elements){
        //     let distanceToEnemy = ManhattanDistance(x, y, agent[1].x, agent[1].y)
        //     enemiesProximity += Math.pow((((1/(distanceToEnemy+1) - 1)) * enemiesProximityCoeff), 2)
        // }
    
    
        return Math.pow(parcelsRewardInCell, 1.2) / Math.pow(distanceToAgent, 1) + minDistanceToBorder/1000
        return Math.pow(parcelsRewardInCell, 1.2) + minDistanceToBorder/1000 - Math.pow(distanceToAgent, 2)
        // la funzione per enemiesProximity va da pathLength +1 a infinito, ed è minima quando è 1 e massima quando è infinito
        // aggiungere decaying score for not visible cells, only for parcelsRewardInThisCell
    }

    deliveryCellHeuristic(x, y, map, agent, parcelsManager, agentsManager){
        let scoreParcelsCarriedByAgent = 0
        for (const parcel of parcelsManager.parcels.elements){
            if(parcel[1].carriedBy == agent.id){
                scoreParcelsCarriedByAgent += parcel[1].reward
            }
        }
    
        let distanceToAgent = 1
        if(scoreParcelsCarriedByAgent != 0){
            distanceToAgent = Math.max(PathLengthBFS(x, y, agent.x, agent.y, map, agentsManager), 0.1)
        }
    
        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
        return Math.pow(scoreParcelsCarriedByAgent, 0.8) - Math.pow(distanceToAgent, 1.2)
    }

    async startPlanning(map, agentsManager, parcelsManager, agent){
        this.plan = []
        while(true){

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] === 0){ // wall cell
                        this.scoreMap[i][j] = 0
                    } else if(this.map[i][j] === 1){ // normal cell
                        this.scoreMap[i][j] = this.normalCellHeuristic(i, j, map, agent, parcelsManager, agentsManager)
                    } else if(this.map[i][j] === 2){ // delivery cell
                        this.scoreMap[i][j] = this.deliveryCellHeuristic(i, j, map, agent, parcelsManager, agentsManager)
                    }
                }
            }

            let target_x = undefined
            let target_y = undefined
            let bestscore = -1
            let intention = undefined
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.scoreMap[i][j] > bestscore && this.map[i][j] !== 0){
                        bestscore = this.scoreMap[i][j]
                        target_x = i
                        target_y = j
                        if(this.map[i][j] === 1){
                            intention = 'pickup'
                        } else if(this.map[i][j] === 2){
                            intention = 'putdown'
                        }
                    }
                }
            }


            this.plan = BFS(agent.x, agent.y, target_x, target_y, map, agentsManager).concat(intention)

            // class Target{
            //     constructor(x, y, score, intention){
            //         this.x = x
            //         this.y = y
            //         this.score = score
            //         this.intention = intention
            //     }
            // }
            // let targets = []

            // for (let i = 0; i < this.n_rows; i++){
            //     for (let j = 0; j < this.n_cols; j++){
            //         if(this.map[i][j] !== 0){
            //             let intention = undefined
            //             if(this.map[i][j] === 1){
            //                 intention = 'pickup'
            //             } else if(this.map[i][j] === 2){
            //                 intention = 'putdown'
            //             }
            //             targets.push(new Target(i, j, this.scoreMap[i][j], intention))
            //         }
            //     }
            // }


            
            // targets.sort((a, b) => {
            //     return b.score - a.score
            // })
            // for(const target in targets){
            //     let tmpPlan = BFS(agent.x, agent.y, target.x, target.y, map , agentsManager).concat(target.intention)
            //     if(tmpPlan[0] != 'error'){
            //         this.plan = tmpPlan
            //         break
            //     }
            // }


            // this.plan = BFS(agent.x, agent.y, target_x, target_y, map, agentsManager).concat(intention)
            //////////////
            //invece di fare il pick del best, riordino le celle e poi una per una faccio BFS fino a quando il plan tornato è diverso
            //da error. Poi ci concateno l'intention

            await new Promise(res => setImmediate(res))
        }
    }

    getPlan(){
        return this.plan
    }

    print(agent){
        console.log('\n-----[SCOREMAP]-----')
        let padding = 4
        let highestValue = -Infinity
        let lowestValue = Infinity
        for (let i = 0; i < this.n_rows; i++){
            for (let j = 0; j < this.n_cols; j++){
                if(this.scoreMap[i][j] > highestValue && this.map[i][j] !== 0){
                    highestValue = this.scoreMap[i][j]
                }
            }
        }
        for (let i = 0; i < this.n_rows; i++){
            for (let j = 0; j < this.n_cols; j++){
                if(this.scoreMap[i][j] < lowestValue && this.map[i][j] !== 0){
                    lowestValue = this.scoreMap[i][j]
                }
            }
        }
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                let value = addPadding(Math.round(100*(this.scoreMap[row][col]-lowestValue)/(highestValue-lowestValue)), padding)
                let shade = getColorHex(value)
                let color = chalk.hex(shade)
                if(agent.x == row && agent.y == col){
                    process.stdout.write(chalk.bgBlue(color(value)))
                } else if(this.map[row][col] == 0){
                    process.stdout.write(addPadding('', padding))
                } else {
                    process.stdout.write(color(value))
                }
            }
            process.stdout.write('\n\n')
        }
        process.stdout.write('-------------------\n')
    }
}

function getColorHex(value) {
    value = Math.max(0, Math.min(100, value));
    
    const red = Math.floor((100 - value) * 255 / 100);
    const green = Math.floor(value * 255 / 100);
    
    const redHex = red.toString(16).padStart(2, '0');
    const greenHex = green.toString(16).padStart(2, '0');
    const hexCode = '#' + redHex + greenHex + '00';
    
    return hexCode;
}
  

function addPadding(item, padding){
    let out = '' + item
    while(out.length < padding){
        out += ' '
    }
    return out
}

export { Planner }