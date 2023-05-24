function ManhattanDistance(x1, y1, x2, y2){
    return Math.abs(x1 - x2) + Math.abs(y1 - y2)
}

class Cell{
    constructor(x, y, parentx=-1, parenty=-1, depth=0, throughAgent=false){
        this.x = x
        this.y = y
        this.parentx = parentx
        this.parenty = parenty
        this.depth = depth
        this.throughAgent = throughAgent
    }
    print(){
        console.log('Cell: ', this.x, this.y, this.parentx, this.parenty)
    }
}

function computeChild(child, map, explored, queue, agentsMap){
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
    return false
}

function PlanBFS(start, goal, explored){
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

function BFS(sx, sy, ex, ey, map, agents, thisAgent, otherAgent, throughAgent=false){
    let agentsMap = [] // 0 = free, 1 = enemy, 2 = friend other agent
    for (let i = 0; i < map.getNRows(); i++){
        agentsMap.push([])
        for (let j = 0; j < map.getNCols(); j++){
            agentsMap[i].push(0)
        }
    }
    if(agents.getMap().size > 0){
        for (const agent of agents.getMap()){
            if(agent[1].id !== thisAgent.id){
                if(agent[1].id === otherAgent.id){
                    if(throughAgent){
                        agentsMap[agent[1].x][agent[1].y] = 2
                    } else {
                        agentsMap[agent[1].x][agent[1].y] = 1
                    }
                } else {
                    agentsMap[agent[1].x][agent[1].y] = 1
                }
            }
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
            return [PlanBFS(start, goal, explored), current.throughAgent]
        }

        let children = []
        let child = new Cell(current.x - 1, current.y)
        if(computeChild(child, map, explored, queue, agentsMap)){
            if(agentsMap[current.x - 1][current.y] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }
        child = new Cell(current.x + 1, current.y)
        if(computeChild(child, map, explored, queue, agentsMap)){
            if(agentsMap[current.x + 1][current.y] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }
        child = new Cell(current.x, current.y - 1)
        if(computeChild(child, map, explored, queue, agentsMap)){
            if(agentsMap[current.x][current.y - 1] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }
        child = new Cell(current.x, current.y + 1)
        if(computeChild(new Cell(current.x, current.y + 1), map, explored, queue, agentsMap)){
            if(agentsMap[current.x][current.y + 1] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }

        children.forEach((child) => {
            queue.push(child)
            child.parentx = current.x
            child.parenty = current.y
            child.throughAgent = current.throughAgent || child.throughAgent
        })
    }
    return [['error'], false]
}

function PathLengthBFS(sx, sy, ex, ey, map, agents, thisAgent, otherAgent, throughAgent=false){
    let agentsMap = []
    for (let i = 0; i < map.getNRows(); i++){
        agentsMap.push([])
        for (let j = 0; j < map.getNCols(); j++){
            agentsMap[i].push(0)
        }
    }
    if(agents.getMap().size > 0){
        for (const agent of agents.getMap()){
            if(agent[1].id !== thisAgent.id){
                if(agent[1].id === otherAgent.id){
                    if(throughAgent){
                        agentsMap[agent[1].x][agent[1].y] = 2
                    } else {
                        agentsMap[agent[1].x][agent[1].y] = 1
                    }
                } else {
                    agentsMap[agent[1].x][agent[1].y] = 1
                }
            }
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
            return [current.depth, current.throughAgent]
        }

        let children = []
        let child = new Cell(current.x - 1, current.y)
        if(computeChild(child, map, explored, queue, agentsMap)){
            if(agentsMap[current.x - 1][current.y] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }
        child = new Cell(current.x + 1, current.y)
        if(computeChild(child, map, explored, queue, agentsMap)){
            if(agentsMap[current.x + 1][current.y] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }
        child = new Cell(current.x, current.y - 1)
        if(computeChild(child, map, explored, queue, agentsMap)){
            if(agentsMap[current.x][current.y - 1] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }
        child = new Cell(current.x, current.y + 1)
        if(computeChild(new Cell(current.x, current.y + 1), map, explored, queue, agentsMap)){
            if(agentsMap[current.x][current.y + 1] === 2){
                child.throughAgent = true
            }
            children.push(child)
        }

        children.forEach((child) => {
            queue.push(child)
            child.parentx = current.x
            child.parenty = current.y
            child.depth = current.depth + 1
            child.throughAgent = current.throughAgent || child.throughAgent
        })
    }
    return [1000, false]
}

export { ManhattanDistance, BFS, PathLengthBFS }