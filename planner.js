import { BFS } from "./util.js"
import { normalCellHeuristic, deliveryCellHeuristic } from "./heuristics.js"
import chalk from "chalk"

class Planner{
    constructor(map, agents, parcels, agent, verbose=false){
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

            this.startPlanning(map, agents, parcels, agent)
            
            if(this.verbose){
                setInterval(() => {
                    this.print(agent)
                    // console.log(this.intention)
                    console.log(this.plan)
                }, 100)
            }
        }, 900)
    }

    async startPlanning(map, agents, parcels, agent){
        this.plan = []
        while(true){
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] === 0){ // wall cell
                        this.scoreMap[i][j] = 0
                    } else if(this.map[i][j] === 1){ // normal cell
                        this.scoreMap[i][j] = normalCellHeuristic(i, j, map, agent, parcels, agents)
                    } else if(this.map[i][j] === 2){ // delivery cell
                        this.scoreMap[i][j] = deliveryCellHeuristic(i, j, map, agent, parcels, agents)
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


            this.plan = BFS(agent.x, agent.y, target_x, target_y, map, agents).concat(intention)

            class TargetCell{
                constructor(x, y, score, intention){
                    this.x = x
                    this.y = y
                    this.score = score
                    this.intention = intention
                }
            }
            let targets = []

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] !== 0)
                    targets.push(new TargetCell(i, j, this.scoreMap[i][j], this.map[i][j] === 1 ? 'pickup' : 'putdown'))
                }
            }

            targets.sort((a, b) => {
                return b.score - a.score
            })

            for(const target of targets){
                let tmpPlan = BFS(agent.x, agent.y, target.x, target.y, map , agents).concat(target.intention)
                if(tmpPlan[0] != 'error'){
                    this.plan = tmpPlan
                    break
                }
            }

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