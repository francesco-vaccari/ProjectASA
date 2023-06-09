import fs from 'fs'
import { Beliefset, PddlProblem, onlineSolver } from "@unitn-asa/pddl-client"

function ManhattanDistance(x1, y1, x2, y2){
    return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}

class Cell{
    constructor(x, y, parentx=-1, parenty=-1, depth=0){
        this.x = x
        this.y = y
        this.parentx = parentx
        this.parenty = parenty
        this.depth = depth
    }
    print(){
        console.log('Cell: ', this.x, this.y, this.parentx, this.parenty)
    }
}

function computeChild(child, map, explored, queue, agentsMap){ // checks if a child is valid and not already explored or queued
    if(child.x >= 0 && child.y >= 0 && child.x < map.getNRows() && child.y < map.getNCols() && map.matrix[child.x][child.y].type !== 0 && agentsMap[child.x][child.y] !== 1){
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

function PlanBFS(start, goal, explored){ // computes the plan from the explored cells
    let plan = []
    let current = new Cell(goal.x, goal.y)
    explored.forEach((cell) => {
        if(current.x === cell.x && current.y === cell.y){
            current.parentx = cell.parentx
            current.parenty = cell.parenty
        }
    })
    while(current.x !== start.x || current.y !== start.y){
        let temp = new Cell(-1, -1)
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

/**
 * Computes the plan to get from the starting cell to the ending cell. Returns an array that contains the series of moves to perform.
 * @param {Number} sx Starting cell x coordinate
 * @param {Number} sy Starting cell y coordinate
 * @param {Number} ex Ending cell x coordinate
 * @param {Number} ey Ending cell y coordinate
 * @param {GameMap} map GameMap object
 * @param {Agents} agents Agents object
 * @returns {Array} Array of moves to perform
 */
function BFS(sx, sy, ex, ey, map, agents){
    let agentsMap = [] // map used to make cells occupied by other agents not walkable
    for (let i = 0; i < map.getNRows(); i++){
        agentsMap.push([])
        for (let j = 0; j < map.getNCols(); j++){
            agentsMap[i].push(0)
        }
    }
    if(agents.getMap().size > 0){
        for (const agent of agents.getMap()){
            agentsMap[agent[1].x][agent[1].y] = 1
        }
    }
    // normal BFS algorithm
    let goal = new Cell(ex, ey)
    let start = new Cell(sx, sy)
    let queue = []
    let explored = []
    queue.push(start)
    while(queue.length > 0){
        
        let current = queue.shift()

        explored.push(current)

        if(current.x === goal.x && current.y === goal.y){
            return PlanBFS(start, goal, explored) // returns computed from the explored set
        }

        let children = [] // array of children of the current cell
        if(computeChild(new Cell(current.x - 1, current.y), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x - 1, current.y))
        }
        if(computeChild(new Cell(current.x + 1, current.y), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x + 1, current.y))
        }
        if(computeChild(new Cell(current.x, current.y - 1), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x, current.y - 1))
        }
        if(computeChild(new Cell(current.x, current.y + 1), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x, current.y + 1))
        }

        children.forEach((child) => { // adds the children to the queue with parent to reconstruct the path
            queue.push(child)
            child.parentx = current.x
            child.parenty = current.y
        })
    }
    return ['error']
}

function PathLengthBFS(sx, sy, ex, ey, map, agents){ // same thing of BFS, but returns only the length of the path
    let agentsMap = []
    for (let i = 0; i < map.getNRows(); i++){
        agentsMap.push([])
        for (let j = 0; j < map.getNCols(); j++){
            agentsMap[i].push(0)
        }
    }
    if(agents.getMap().size > 0){
        for (const agent of agents.getMap()){
            agentsMap[agent[1].x][agent[1].y] = 1
        }
    }
    let goal = new Cell(ex, ey)
    let start = new Cell(sx, sy)
    let queue = []
    let explored = []
    queue.push(start)
    while(queue.length > 0){
        
        let current = queue.shift()

        explored.push(current)

        if(current.x === goal.x && current.y === goal.y){
            return current.depth
        }

        let children = []
        if(computeChild(new Cell(current.x - 1, current.y), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x - 1, current.y))
        }
        if(computeChild(new Cell(current.x + 1, current.y), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x + 1, current.y))
        }
        if(computeChild(new Cell(current.x, current.y - 1), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x, current.y - 1))
        }
        if(computeChild(new Cell(current.x, current.y + 1), map, explored, queue, agentsMap)){
            children.push(new Cell(current.x, current.y + 1))
        }

        children.forEach((child) => {
            queue.push(child)
            child.parentx = current.x
            child.parenty = current.y
            child.depth = current.depth + 1
        })
    }
    return 1000
}

function readFile ( path ) {
    
    return new Promise( (res, rej) => {

        fs.readFile( path, 'utf8', (err, data) => {
            if (err) rej(err)
            else res(data)
        })

    })

}

function translatePddl(pddlPlan) { // convert the plan obtained by the solver into a series of Deliveroo.js actions
    let plan = []
    let from, to;
    if (pddlPlan != undefined) {
        for (const action of pddlPlan) {
            switch (action.action) {
                case "move":
                    from = action.args[0].split("_").slice(1);
                    to = action.args[1].split("_").slice(1);
                    if (to[0] - from[0] > 0) {
                        plan.push("right")
                    } else if (to[0] - from[0] < 0) {
                        plan.push("left")
                    } else if (to[1] - from[1] > 0) {
                        plan.push("up")
                    } else if (to[1] - from[1] < 0) {
                        plan.push("down")
                    }
                    break;
            }
        }
    }
    return plan
}

async function pddlBFS(sx, sy, ex, ey, map, agents, thisAgent, domain) { // create an updated version of this.mapBeliefset and compute a BFS using the onlineSolver

    let tmpBeliefset,problem

    let tmpPlan = []

    if (ex != sx || ey != sy) {
        tmpBeliefset = new Beliefset()
        for (const entry of map.mapBeliefset.entries) { // create a copy of this.mapBeliefset
            tmpBeliefset.declare(entry[0])
        }
        for (const agent of agents.getMap()){ // consider the other agents as walls
            if(agent[1].id !== thisAgent.id){
                tmpBeliefset.declare("cell c_" + agent[1].x + "_" + agent[1].y,false)
            }
        }
        tmpBeliefset.declare("in c_" + sx + "_" + sy) // set the actual agent position
        problem = new PddlProblem("BFS",
            tmpBeliefset.objects.join(' '),
            tmpBeliefset.toPddlString(),
            "in c_" + ex + "_" + ey)
        try {
            //console.log("a",sx, sy, ex, ey);
            // console.log(problem.toPddlString());
            tmpPlan = translatePddl(await onlineSolver(domain,problem.toPddlString())) // compute a plan and translate it
        } catch (error) {
            // console.log(error);
            return [['error'], false]
        }
    }

    return tmpPlan;
}

export { ManhattanDistance, BFS, PathLengthBFS, readFile, pddlBFS }