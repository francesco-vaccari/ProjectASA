import {  } from "./dataStructures.js";

function computeManhattanDistance(x1, y1, x2, y2){
    return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}

class Cell{
    constructor(x, y, ex, ey){
        this.x = x
        this.y = y
        this.g = 1
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

/**
 * Computes the plan to get from the starting cell to the ending cell. Returns an array that contains the series of moves to perform.
 * @param {Number} sx Starting cell x coordinate
 * @param {Number} sy Starting cell y coordinate
 * @param {Number} ex Ending cell x coordinate
 * @param {Number} ey Ending cell y coordinate
 * @param {GameMap} map GameMap object
 * @returns {Array} Array of moves to perform
 */
function BFS(sx, sy, ex, ey, map){
    let goal = new CellBFS(ex, ey)
    let start = new CellBFS(sx, sy)
    let queue = []
    let explored = []
    queue.push(start)
    while(queue.length > 0){
        
        let current = queue.shift()

        explored.push(current)

        if(current.x === goal.x && current.y === goal.y){
            return PlanBFS(start, goal, explored)
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

        children.forEach((child) => {
            queue.push(child)
            child.parentx = current.x
            child.parenty = current.y
        })
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

function PlanBFS(start, goal, explored){
    let plan = []
    let current = new CellBFS(goal.x, goal.y)
    explored.forEach((cell) => {
        if(current.x === cell.x && current.y === cell.y){
            current.parentx = cell.parentx
            current.parenty = cell.parenty
        }
    })
    while(current.x !== start.x || current.y !== start.y){
        let temp = new CellBFS(-1, -1)
        explored.forEach((cell) => {
            if(cell.x === current.parentx && cell.y === current.parenty){
                temp.x = cell.x
                temp.y = cell.y
                temp.parentx = cell.parentx
                temp.parenty = cell.parenty
            }
        })
        if(current.x > temp.x && current.y === temp.y){
            plan.push('right')
        } else if(current.x < temp.x && current.y === temp.y){
            plan.push('left')
        } else if(current.x === temp.x && current.y > temp.y){
            plan.push('up')
        } else if(current.x === temp.x && current.y < temp.y){
            plan.push('down')
        }
        current = temp
    }
    return plan.reverse()
}



export { Astar, computeManhattanDistance, BFS };