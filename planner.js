import { ManhattanDistance, BFS } from "./util.js";
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const SortedArraySet = require("collections/sorted-array-set")

class Cell {
    constructor(x,y,score){
        this.x = x
        this.y = y
        this.score = score
    }

    equals(other){
        return this.x == other.x && this.y == other.y
    }

    toString(){
        return '(' + this.x + ',' + this.y + ',' + this.score + ')'
    }
}

class OrderedCells {
    constructor(equals,compare) {
        this.elements = new SortedArraySet({},equals,compare);
    }

    /**
     * 
     * @param {Cell} cell 
     * @returns Boolean
     */
    add(cell){
        let add = this.elements.has(cell);
        if(!add){
            this.elements.add(cell);
        }
        return add;
    }

    removeParcelId(cell) {
        this.elements.delete(cell);
    }

    getFirst(){
        return this.elements.max();
    }

    printScoredMap(n_rows,n_cols) {
        let tmpCell,cell;
        for (let row = 0; row < n_rows; row++) {
            for (let col = 0; col < n_cols; col++) {
                tmpCell = new Cell(row,col)
                cell = this.elements.get(tmpCell)
                if (cell != undefined){
                    process.stdout.write(' ' + cell.score)
                } else {
                    process.stdout.write('  ')
                }
            }
            console.log()
        }
    }

    print(){
        console.log('\n///////[ORDERED CELLS LIST]///////')
        this.elements.forEach(cell => {
            console.log(cell.toString())
        });
        console.log('////////////////////////////\n')
    }
}

class Planner{
    constructor(map, verbose=false){
        setTimeout(() => {
            this.n_rows = map.n_rows
            this.n_cols = map.n_cols
            this.matrix = map.matrix
            this.scoreMap = new OrderedCells(
                /**
                 * 
                 * @param {Cell} a 
                 * @param {Cell} b 
                 * @returns Boolean
                 */
                (a,b) => a.equals(b),
                /**
                 * 
                 * @param {Cell} a 
                 * @param {Cell} b 
                 * @returns Number
                 */
                (a,b) => a.score < b.score ? 1 : a.score > b.score ? -1 : 0)
            let minBorderCell,cell,newDistance;
            for (let col = 0; col < this.n_cols; col++){
                for (let row = 0; row < this.n_rows; row++){
                    if(this.matrix[row][col] === 1 || this.matrix[row][col] === 2) {
                        minBorderCell = new Cell(this.n_rows*2,this.n_cols*2,0)
                        cell = new Cell(row,col,0)
                        for (let deliveryRow = 0; deliveryRow < this.n_rows; deliveryRow++) {
                            for (let deliveryCol = 0; deliveryCol < this.n_cols; deliveryCol++) {
                                if (this.matrix[deliveryRow][deliveryCol] === 2) {
                                    let deliveryCell = new Cell(deliveryRow,deliveryCol,0)
                                    newDistance = ManhattanDistance(cell.x,cell.y,deliveryCell.x,deliveryCell.y)
                                    if (newDistance < ManhattanDistance(cell.x,cell.y,minBorderCell.x,minBorderCell.y)) {
                                        minBorderCell = new Cell(deliveryCell.x,deliveryCell.y,0)
                                        cell.score = newDistance
                                    }
                                }
                            }   
                        }
                        this.scoreMap.add(cell)
                    }
                }
            }
            this.scoreMap.printScoredMap(this.n_rows,this.n_cols)
            this.scoreMap.print()
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