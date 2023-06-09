import { ManhattanDistance, BFS, PathLengthBFS, readFile, pddlBFS  } from "./util.js"

class Target{ // Target class, used to store the target of the agent
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention // can be: 'pickup', 'delivery', 'idle', 'error'
        this.score = score // score of the target, is the output of the utility functions, used to sort the targets
    }
}

class Planner{ // in this class there is all the logic regarding choice of intentions and plan generation
    constructor(client, map, agent, parcels, agents, control, verbose=false){ // takes as input all the beliefs
        this.client = client
        this.verbose = verbose
        this.map = map
        this.agent = agent
        this.parcels = parcels
        this.agents = agents
        this.plan = [] // plan of actions
        this.target = new Target(this.agent.x, this.agent.y, 'error', 0) // target of the agent
        this.control = control
        this.domain = "" // PDDL domain description
        this.startPlanning() // main loop
        if(this.verbose){
            setInterval(() => {
                console.log('[TARGET]', this.target.x, this.target.y, this.target.intention)
                // console.log('PLAN', this.plan)
            }, 200)
        }
    }
    async startPlanning(){ // main loop of the planner, computes possible intentions and chooses the best one to pursue
        this.domain = await readFile("./domain.pddl")
        while(true){
            if(this.control.ready){ // if the agent is ready to make a move, starts planning
                let targets = [] // list containing all the possible targets/intentions with their score
                targets = this.getTargetsIdleMovement().concat(targets) // put in the targets list all the targets with intention 'idle'
                if(this.agentKnowsParcels() || this.agentCarriesParcels()){ // if the agent carries or knows the position of parcels
                    targets = this.getTargetsWithUtility().concat(targets) // compute the targets with intention 'pickup' and 'delivery'
                }
                for(const target of targets){ // iterates through all the intentions/targets found, the targets are already sorted by score
                    // uncomment the next line and comment the await pddlBFS to use the BFS planning algorithm
                    //let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents)
                    let tmpPlan = await pddlBFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.domain)
                    if(tmpPlan[0] != 'error'){ // if a plan is found for a target, assign that plan to the class variable
                        this.plan = tmpPlan
                        console.log(this.plan);
                        this.target = target
                        break
                    }
                }
                if(this.target.intention === 'pickup'){ // concatentate to the plan the correct action 'pickup' or 'putdown' to perform
                    this.plan = this.plan.concat(['pickup'])
                } else if(this.target.intention === 'delivery'){
                    this.plan = this.plan.concat(['putdown'])
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }

    getTargetsIdleMovement(){ // returns a sorted list of all the possible targets with intention 'idle'
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){ // iterates through the game map
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3){ // if a cell is a spawning cell
                    let tempTarget = new Target(row, col, 'idle', this.map.getMatrix()[row][col].lastSeen) // add the target to the list
                    targets.push(tempTarget)
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1) // sort the targets by score, which is the lastSeen value of the spawning cell
        return targets
    }
    getTargetsWithUtility(){ // returns a sorted list of all the possible targets with intention 'pickup' or 'delivery'
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){ // iterates through the game map
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3 || this.map.getMatrix()[row][col].type === 1){ // if a cell is a spawning cell or a normal cell
                    let score = this.getNormalCellUtility(row, col) // get the score of the cell with the utility function
                    targets.push(new Target(row, col, 'pickup', score))
                } else if(this.map.getMatrix()[row][col].type === 2){ // if a cell is a delivery cell
                    let score = this.getDeliveryCellUtility(row, col) // get the score of the cell with the utility function
                    targets.push(new Target(row, col, 'delivery', score))
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1) // sort the targets by score, which is the utility functions output for the cell
        return targets
    }
    getNormalCellUtility(x, y){ // utility function for cells for normal or spawning cells, returns the score of the cell
        let minDistanceToBorder = 10000000 // describes the minimum distance from the cell to the closest delivery cell
        let borderx = undefined
        let bordery = undefined
        for (let i = 0; i < this.map.getNRows(); i++){
            for(let j = 0; j < this.map.getNCols(); j++){
                if(this.map.getMatrix()[i][j].type === 2){
                    let tempDist = ManhattanDistance(x, y, i, j)
                    if(tempDist < minDistanceToBorder){
                        minDistanceToBorder = tempDist
                        borderx = i
                        bordery = j
                    }
                }
            }
        }

        let parcelsRewardInCell = 0 // describes the reward of the parcels in the cell
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
                parcelsRewardInCell += parcel[1].reward
            }
        }

        let distanceToAgent = 1 // describes the distance from the cell to the agent
        if(parcelsRewardInCell != 0){
            distanceToAgent =  Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents), 0.1)
        }

        let enemiesProximity = 1 // scaling factor to lower the score of cells near enemies
        if(this.agents.getMap().size > 0){
            for (const agent of this.agents.getMap()){
                let tmp = ManhattanDistance(x, y, agent[1].x, agent[1].y) + 1
                tmp = - (1 / tmp) + 1
                if(tmp < enemiesProximity){
                    enemiesProximity = tmp
                }
            }
        }
        // final utility formula
        return (Math.pow(parcelsRewardInCell, 1.2) / Math.pow(distanceToAgent, 1)) * Math.pow(enemiesProximity, 2)
    }
    getDeliveryCellUtility(x, y){ // utility function for delivery cells, returns the score of the cell
        let scoreParcelsCarriedByAgent = 0 // total reward of the parcels carried by the agent
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == this.agent.id){
                scoreParcelsCarriedByAgent += parcel[1].reward
            }
        }

        let distanceToAgent = 1 // distance from the cell to the agent
        if(scoreParcelsCarriedByAgent != 0){
            distanceToAgent = Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents), 0.1)
        }
        // final utility formula
        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
    }
    agentKnowsParcels(){ // return true if the parcels list is not empty
        return this.parcels.getMap().size > 0
    }
    agentCarriesParcels(){ // return true if the agent is carrying parcels
        let carry = false
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == this.agent.id){
                carry = true
                break
            }
        }
        return carry
    }
    getPlan(){
        return this.plan
    }
}

export { Planner }