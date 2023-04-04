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


class Cell{
    constructor(x, y){
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
    let end = new Cell(ex, ey)
    let openList = []
    let closedList = []
    let current = new Cell(sx, sy)
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
            neighbours.push(new Cell(current.x - 1, current.y))
        }
        if(current.x + 1 < map.n_cols && map.matrix[current.x + 1][current.y] !== 0){
            neighbours.push(new Cell(current.x + 1, current.y))
        }
        if(current.y - 1 >= 0 && map.matrix[current.x][current.y - 1] !== 0){
            neighbours.push(new Cell(current.x, current.y - 1))
        }
        if(current.y + 1 < map.n_rows && map.matrix[current.x][current.y + 1] !== 0){
            neighbours.push(new Cell(current.x, current.y + 1))
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

export { Astar };