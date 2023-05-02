import { computeManhattanDistance, BFS } from "./util.js";

class CellMap{
    constructor(x, y, walkable, deliverable){
        this.x = x
        this.y = y
        this.walkable = walkable
        this.deliverable = deliverable
        this.score = 0
    }
}

class Planner{
    constructor(map, verbose=false){
        setTimeout(() => {
            this.n_rows = map.n_rows
            this.n_cols = map.n_cols
            this.matrix = map.matrix
            this.verbose = verbose
            if(this.verbose){
                console.log('ScoreMap initialized')
                this.print()
            }
            this.startPlanning()
        }, 900)
    }

    async startPlanning(){
        this.plan = []
        while(true){
            let n = Math.floor(Math.random() * 4)
            let direction = ''
            if (n == 0){
                direction = 'up'
            } else if (n == 1){
                direction = 'down'
            } else if (n == 2){
                direction = 'left'
            } else if (n == 3){
                direction = 'right'
            }
            this.plan = [direction]
            await new Promise(res => setImmediate(res))
        }
    }

    getPlan(){
        return this.plan
    }

    print(){
        console.log('\n-----[SCOREMAP]----')
        let out = ''
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                if(this.matrix[row][col] === 0){
                    out += '  '
                } else {
                    out += this.matrix[row][col] + ' '
                }
            }
            out += '\n'
        }
        console.log(out)
        console.log('-------------------\n')
    }
}

export { Planner }