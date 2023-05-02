import { ManhattanDistance, BFS } from "./util.js";

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




            // let n = Math.floor(Math.random() * 4)
            // let direction = ''
            // if (n == 0){
            //     direction = 'up'
            // } else if (n == 1){
            //     direction = 'down'
            // } else if (n == 2){
            //     direction = 'left'
            // } else if (n == 3){
            //     direction = 'right'
            // }
            // this.plan = [direction]

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