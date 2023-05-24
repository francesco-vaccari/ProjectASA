import { ManhattanDistance, BFS, PathLengthBFS } from "./util.js"

class Target{
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention
        this.score = score
    }
}

class Planner{
    constructor(client, map, agent, otherAgent, parcels, agents, comm, verbose=false){
        this.client = client
        this.verbose = verbose
        this.normalPlanning = true
        this.exchangeMaster = false
        this.exchangeSlave = false
        this.blockStrategy = false
        this.map = map
        this.agent = agent
        this.otherAgent = otherAgent
        this.parcels = parcels
        this.agents = agents
        this.comm = comm
        this.plan = ['error']
        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
        this.startPlanning()
        if(this.verbose){
            setInterval(() => {
                console.log('['+this.agent.name+']\tTARGET', this.target.x, this.target.y, this.target.intention)
                // console.log('PLAN', this.plan)
            }, 200)
        }
    }
    async startPlanning(){
        while(true){
            if(this.checkAllInitialized()){
                
                if(this.blockStrategy){
                    // implement blocking strategy
                    /*
                    
                    Un possibile caso particolare è quello di bloccare i path degli agenti nemici verso le caselle di delivery, ma questo funziona 
                    solo se i due agenti nemici sono in celle i quali path verso celle di delivery passano tutti nelle posizioni in cui gli agenti 
                    si posizionerebbero per bloccare i path. Ovviamente questa strategia funziona solo in caso di vantaggio. Un'altra cosa è che 
                    dovremmo sapere con esattezza le posizioni di entrambi gli agenti nemici prima di poter eseguire questa strategia. Dopo l'esecuzione 
                    ci sposteremmo solo nel caso in cui lo score degli avversari superare il nostro. Una variante più semplice sarebbe quella di 
                    posizionarsi direttamente sulle celle di delivery nel caso in cui fossero solo due.
                    
                    if(N delivery cells < 3 and can reach with both agents){
                        i can block the delivery cells directly
                        if(we are up in score and both agents paths are shorter than enemies to delivery cells and enemies are visible){
                            each of our agents picks as target the closest delivery cells and blocks it
                        }
                    }
                    
                    Altrimenti se ci sono più delivery cells devo identificare i choke point in cui posso bloccare l'accesso a tutte le delivery cells.
                    Se siamo sopra di punti e i nostri agenti hanno un path più corto di quello degli avversari allora posso bloccare i choke point.
                    
                    */
                } else if(this.exchangeMaster || this.exchangeSlave){

                    if(this.exchangeMaster){
                        this.target = this.calculateExchangeCommonTarget()

                        if(this.target.intention === 'error'){
                            this.exchangeMaster = false
                            this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                        } else {
                            let tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                            if(tmpPlan[0] === 'error'){
                                this.exchangeMaster = false
                                this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                            } else {
                                this.plan = tmpPlan
                            }
                        }

                    }
                    
                    if(this.exchangeSlave){
                        let tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                        if(tmpPlan[0] === 'error'){
                            this.exchangeSlave = false
                        } else {
                            this.plan = tmpPlan
                        }
                    }
                    
                    // calculate path to get to two cells of distance for both agents and tell target
                    // then make one more step and put down parcels
                    // then move in any direction, if this is not succesfful there might be problems
                    // tell other agent to make move towards parcels and pick up
                    // resume normal execution

                } else if(this.normalPlanning){
                    let targets = []
                    targets = this.getTargetsIdleMovement().concat(targets)
                    if(this.agentKnowsParcels() || this.agentCarriesParcels()){
                        targets = this.getTargetsWithUtility().concat(targets)
                    }
    
                    let found = false
                    for(const target of targets){
                        if(!found){
                            if(target.intention === 'delivery'){
                                let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent, true)
                                if(tmpPlan[0][0] != 'error'){
                                    if(tmpPlan[1]){
                                        found = true
                                        this.plan = []
                                        this.target = new Target(this.agent.x, this.agent.y, 'exchange')
                                        this.exchangeMaster = true
                                        this.comm.say(JSON.stringify({belief: 'EXCHANGE'}))
                                    } else {
                                        this.plan = tmpPlan[0]
                                        this.target = target
                                        found = true
                                    }
                                }
                            } else {
                                let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent)
                                if(tmpPlan[0] != 'error'){
                                    this.plan = tmpPlan[0]
                                    this.target = target
                                    found = true
                                }
                            }
                        }
                    }
    
                    if(!found){
                        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
                        this.plan = []
                    } else {
                        if(this.target.intention === 'pickup'){
                            this.plan = this.plan.concat(['pickup'])
                        } else if(this.target.intention === 'delivery'){
                            this.plan = this.plan.concat(['putdown'])
                        }
                    }
    
                } else {
                    console.log('error, unknown planning strategy')
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }

    checkAllInitialized(){
        return true
    }

    calculateExchangeCommonTarget(){
        let tmpPlan = BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)
        if(tmpPlan[0][0] === 'error'){
            return new Target(this.agent.x, this.agent.y, 'error', 0)
        } else {
            if(tmpPlan[0].length % 2 === 0){
                let halfPlanPlus2 = tmpPlan[0].slice(0, ((tmpPlan[0].length - 2) / 2) + 2)
                this.comm.say(JSON.stringify({belief: 'TARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                let halfPlan = tmpPlan[0].slice(0, (tmpPlan[0].length - 2) / 2)
                return this.translatePlanIntoTarget(halfPlan)
            } else {
                let halfPlanPlus2 = tmpPlan[0].slice(0, Math.floor((tmpPlan[0].length - 2) / 2) + 3)
                this.comm.say(JSON.stringify({belief: 'TARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                let halfPlan = tmpPlan[0].slice(0, Math.floor((tmpPlan[0].length - 2) / 2) + 1)
                return this.translatePlanIntoTarget(halfPlan)
            }
        }
    }

    translatePlanIntoTarget(plan){
        let x = this.agent.x
        let y = this.agent.y
        for(const move of plan){
            if(move === 'up'){
                y += 1
            } else if (move === 'right'){
                x += 1
            } else if (move === 'down'){
                y -= 1
            } else if (move === 'left'){
                x -= 1
            }
        }
        return new Target(x, y, 'exchange', 0)
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
                    if(score > 0){
                        targets.push(new Target(row, col, 'pickup', score))
                    }
                } else if(this.map.getMatrix()[row][col].type === 2){
                    let score = this.getDeliveryCellUtility(row, col)
                    if(score > 0){
                        targets.push(new Target(row, col, 'delivery', score))
                    }
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
            distanceToAgent =  Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents, this.agent, this.otherAgent)[0], 0.1)
        }

        let enemiesProximity = 1
        if(this.agents.getMap().size > 0){
            for (const agent of this.agents.getMap()){
                if(agent[1].id !== this.agent.id){
                    let tmp = ManhattanDistance(x, y, agent[1].x, agent[1].y) + 1
                    tmp = - (1 / tmp) + 1
                    if(tmp < enemiesProximity){
                        enemiesProximity = tmp
                    }
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
            distanceToAgent = Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents, this.agent, this.otherAgent)[0], 0.1)
        }

        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
    }
    agentKnowsParcels(){
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == null){
                return true
            }
        }
        return false
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