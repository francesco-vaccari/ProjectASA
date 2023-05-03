import { ManhattanDistance, BFS } from "./util.js";

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
                    this.print()
                }, 700)
            }
        }, 900)
    }

    normalCellHeuristic(x, y, agent, parcelsManager, agentsManager){
        let minDistanceToBorder = 100000
        let borderx = undefined
        let bordery = undefined
        for (let i = 0; i < this.n_rows; i++){
            for(let j = 0; j < this.n_cols; j++){
                if(this.map[i][j] === 2){
                    let tempDist = ManhattanDistance(x, y, i, j)
                    if(tempDist < minDistanceToBorder){
                        minDistanceToBorder = tempDist
                        borderx = i
                        bordery = j
                    }
                }
            }
        }
        
        return minDistanceToBorder+1
    }

    deliveryCellHeuristic(x, y, agent, parcelsManager, agentsManager){
        return 1
    }

    async startPlanning(map, agentsManager, parcelsManager, agent){
        this.plan = []
        while(true){

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] === 0){ // wall cell
                        this.scoreMap[i][j] = 0
                    } else if(this.map[i][j] === 1){ // normal cell
                        this.scoreMap[i][j] = this.normalCellHeuristic(i, j, agent, parcelsManager, agentsManager)
                    } else if(this.map[i][j] === 2){ // delivery cell
                        this.scoreMap[i][j] = this.deliveryCellHeuristic(i, j, agent, parcelsManager, agentsManager)
                    }
                }
            }

            let bestx = undefined
            let besty = undefined
            let bestscore = -1
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.scoreMap[i][j] > bestscore){
                        bestscore = this.scoreMap[i][j]
                        bestx = i
                        besty = j
                    }
                }
            }

            this.plan = BFS(agent.x, agent.y, bestx, besty, map)

            /*
            for each cell in the matrix compute the heuristic score
            pick the cell with highest score
            compute path with BFS/PDDL to that cell
            set plan to that path
            */
            await new Promise(res => setImmediate(res))
        }
    }

    getPlan(){
        return this.plan
    }

    print(){
        console.log('\n-----[SCOREMAP]-----')
        let out = ''
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                if(this.scoreMap[row][col] == 0){
                    out += '  '
                } else {
                    out += this.scoreMap[row][col] + ' '
                }
            }
            out += '\n'
        }
        console.log(out)
        console.log('-------------------\n')
    }
}

export { Planner }