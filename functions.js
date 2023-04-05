import { Belief, Beliefs, Desire, Desires, Intention, Intentions, Parcel, Parcels, Percept, Action, Policy, OrderedParcelsId } from "./dataStructures.js";

/**
 * Beliefs revision
 * @param {Beliefs} beliefs 
 * @param {Percept} percept 
 * @returns {Beliefs}
 */
function brf(beliefs, percept) {
    return null;
}

/**
 * 
 * @param {Beliefs} beliefs 
 * @param {Intentions} intentions 
 * @returns {Desires}
 */
function options(beliefs,intentions) {
    return null;
}

/**
 * 
 * @param {Beliefs} beliefs 
 * @param {Desires} desires 
 * @param {Intentions} intentions 
 * @returns {Intentions}
 */
function filter(beliefs,desires,intentions) {
    return null;
}

/**
 * 
 * @param {Beliefs} beliefs 
 * @param {Intentions} intentions 
 * @returns {Policy}
 */
function plan(beliefs,intentions) {
    return null;
}

function computeManhattanDistance(x1, y1, x2, y2){
    return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}

class Cell{
    constructor(x, y, ex, ey){
        this.x = x
        this.y = y
        this.g = 1
        // this.h = computeManhattanDistance(this.x, this.y, ex, ey)
        this.h = 0
        this.f = 0
    }
    print(){
        console.log('Cell: ', this.x, this.y)
    }
}

function Astar(sx, sy, ex, ey, map){
    let end = new Cell(ex, ey, ex, ey)
    let openList = []
    let closedList = []
    let current = new Cell(sx, sy, ex, ey)
    let neighbours = []

    openList.push(current)

    while(openList.length > 0){
        // console.log(openList)
        current = openList[0]
        for(let i = 0; i < openList.length; i++){
            if(openList[i].f < current.f){
                current = openList[i]
            }
        }

        openList = openList.filter(cell => cell !== current)
        closedList.push(current)

        if(current.x === end.x && current.y === end.y){
            let path = []
            let temp = current
            while(temp.previous){
                path.push(temp)
                temp = temp.previous
            }
            return path.reverse()
        }

        neighbours = []
        // console.log('map')
        // map.print()
        // console.log('asffsa', current.x, current.y)
        // console.log('matrix', map.matrix[current.x][current.y])
        if(current.x - 1 >= 0 && map.matrix[current.x - 1][current.y] !== 0){
            neighbours.push(new Cell(current.x - 1, current.y, ex, ey))
        }
        if(current.x + 1 < map.n_cols && map.matrix[current.x + 1][current.y] !== 0){
            neighbours.push(new Cell(current.x + 1, current.y, ex, ey))
        }
        if(current.y - 1 >= 0 && map.matrix[current.x][current.y - 1] !== 0){
            neighbours.push(new Cell(current.x, current.y - 1, ex, ey))
        }
        if(current.y + 1 < map.n_rows && map.matrix[current.x][current.y + 1] !== 0){
            neighbours.push(new Cell(current.x, current.y + 1, ex, ey))
        }

        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i]
            if(!closedList.includes(neighbour)){
                let tempG = current.g + 1
                let newPath = false
                if(openList.includes(neighbour)){
                    if(tempG < neighbour.g){
                        neighbour.g = tempG
                        newPath = true
                    }
                } else {
                    neighbour.g = tempG
                    newPath = true
                    openList.push(neighbour)
                }
                if(newPath){
                    neighbour.h = 0
                    neighbour.f = neighbour.g + neighbour.h
                    neighbour.previous = current
                }
            }
        }
    }
}

class CellBFS{
    constructor(x, y, parentx=-1, parenty=-1){
        this.x = x
        this.y = y
        this.parentx = parentx
        this.parenty = parenty
    }
    print(){
        console.log('Cell: ', this.x, this.y, this.parentx, this.parenty)
    }
}


function computeChild(child, map, explored, queue){
    if(child.x >= 0 && child.y >= 0 && child.x < map.n_rows && child.y < map.n_cols && map.matrix[child.x][child.y] !== 0){
        let already_explored = false
        explored.forEach((cell) => {
            if(cell.x === child.x && cell.y === child.y){
                already_explored = true
            }
        })
        let already_queued = false
        queue.forEach((cell) => {
            if(cell.x === child.x && cell.y === child.y){
                already_queued = true
            }
        })
        return (!already_explored && !already_queued)
    }
}

function BFS(sx, sy, ex, ey, map){
    let goal = new CellBFS(ex, ey)
    let queue = []
    let explored = []
    queue.push(new CellBFS(sx, sy))
    while(queue.length > 0){
        
        let current = queue.shift()

        explored.push(current)
        // console.log('------------------\nexplored', explored)
        // console.log('queue', queue)
        // console.log('current', current)

        if(current.x === goal.x && current.y === goal.y){
            return explored
        }

        let children = []
        if(computeChild(new CellBFS(current.x - 1, current.y), map, explored, queue)){
            children.push(new CellBFS(current.x - 1, current.y))
        }
        if(computeChild(new CellBFS(current.x + 1, current.y), map, explored, queue)){
            children.push(new CellBFS(current.x + 1, current.y))
        }
        if(computeChild(new CellBFS(current.x, current.y - 1), map, explored, queue)){
            children.push(new CellBFS(current.x, current.y - 1))
        }
        if(computeChild(new CellBFS(current.x, current.y + 1), map, explored, queue)){
            children.push(new CellBFS(current.x, current.y + 1))
        }
        // console.log('children', children)

        children.forEach((child) => {
            // console.log(child)
            queue.push(child)
            child.parentx = current.x
            child.parenty = current.y
        })
    }
}



export { Astar, computeManhattanDistance, BFS };