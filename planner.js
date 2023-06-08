import { ManhattanDistance, BFS, PathLengthBFS  } from "./util.js"

class Target{
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention
        this.score = score
    }
}

class Planner{
    constructor(client, map, agent, parcels, agents, verbose=false){
        this.client = client
        this.verbose = verbose
        this.map = map
        this.agent = agent
        this.parcels = parcels
        this.agents = agents
        this.plan = []
        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
        this.startPlanning()
        if(this.verbose){
            setInterval(() => {
                console.log('[TARGET]', this.target.x, this.target.y, this.target.intention)
                // console.log('PLAN', this.plan)
            }, 200)
        }
    }
    async startPlanning(){
        while(true){
            let targets = []
            targets = this.getTargetsIdleMovement().concat(targets)
            if(this.agentKnowsParcels() || this.agentCarriesParcels()){
                targets = this.getTargetsWithUtility().concat(targets)
            }
            for(const target of targets){
                let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents)
                if(tmpPlan[0] != 'error'){
                    this.plan = tmpPlan
                    this.target = target
                    break
                }
            }
            if(this.target.intention === 'pickup'){
                this.plan = this.plan.concat(['pickup'])
            } else if(this.target.intention === 'delivery'){
                this.plan = this.plan.concat(['putdown'])
            }

            await new Promise(res => setImmediate(res))
        }
    }

    getTargetsIdleMovement(){
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3){
                    let tempTarget = new Target(row, col, 'idle', this.map.getMatrix()[row][col].lastSeen)
                    targets.push(tempTarget)
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1)
        return targets
    }
    getTargetsWithUtility(){
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3 || this.map.getMatrix()[row][col].type === 1){
                    let score = this.getNormalCellUtility(row, col)
                    targets.push(new Target(row, col, 'pickup', score))
                } else if(this.map.getMatrix()[row][col].type === 2){
                    let score = this.getDeliveryCellUtility(row, col)
                    targets.push(new Target(row, col, 'delivery', score))
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1)
        return targets
    }
    getNormalCellUtility(x, y){
        let minDistanceToBorder = 10000000
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

        let parcelsRewardInCell = 0
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
                parcelsRewardInCell += parcel[1].reward
            }
        }

        let distanceToAgent = 1
        if(parcelsRewardInCell != 0){
            distanceToAgent =  Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents), 0.1)
        }

        let enemiesProximity = 1
        if(this.agents.getMap().size > 0){
            for (const agent of this.agents.getMap()){
                let tmp = ManhattanDistance(x, y, agent[1].x, agent[1].y) + 1
                tmp = - (1 / tmp) + 1
                if(tmp < enemiesProximity){
                    enemiesProximity = tmp
                }
            }
        }
        return (Math.pow(parcelsRewardInCell, 1.2) / Math.pow(distanceToAgent, 1)) * Math.pow(enemiesProximity, 2)
    }
    getDeliveryCellUtility(x, y){
        let scoreParcelsCarriedByAgent = 0
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == this.agent.id){
                scoreParcelsCarriedByAgent += parcel[1].reward
            }
        }

        let distanceToAgent = 1
        if(scoreParcelsCarriedByAgent != 0){
            distanceToAgent = Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents), 0.1)
        }

        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
    }
    agentKnowsParcels(){
        return this.parcels.getMap().size > 0
    }
    agentCarriesParcels(){
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