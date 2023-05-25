import { ManhattanDistance, BFS, PathLengthBFS } from "./util.js"

let sendLimit = true
setInterval(() => {
    sendLimit = true
}, 10)

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
        this.exchangeMaster = false
        this.exchangeSlave = false
        this.endExchangeTarget = new Target(-1, -1, 'error', 0)
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
        this.sendTargetToOtherAgent()
        this.sendScoreParcelsCarriedToOtherAgent()
        if(this.verbose){
            setInterval(() => {
                console.log('['+this.agent.name+']\tTARGET', this.target.x, this.target.y, this.target.intention)
                // console.log('PLAN', this.plan)
            }, 200)
        }
    }
    async startPlanning(){
        while(true){
            if(this.checkAllInitialized()){ // probably not needed to check all initialized
                
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
                    let tmpPlan = []
                    // EXCHANGE STRATEGY
                    // calculate path to get to two cells of distance for both agents and tell target
                    // then makes one more step towards other agent
                    // putdowns parcels carried
                    // makes one step back and tells other agent the new target (the parcels on the ground)
                    // other agent picks up parcels and ends the exchange intention for both agents
                    // resume normal execution with now the slave with all the parcels and the master with none
                    if(this.exchangeMaster){
                        this.target = this.calculateExchangeCommonTarget()
                        let pathLenToOtherAgent = PathLengthBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                        if(pathLenToOtherAgent < 3){
                            if(pathLenToOtherAgent === 2 && this.agentCarriesParcels()){
                                tmpPlan = BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].slice(0, 1)
                            } else if (pathLenToOtherAgent === 1 && this.agentCarriesParcels()){
                                tmpPlan = ['putdown']
                            } else if(pathLenToOtherAgent === 1 && !this.agentCarriesParcels()){
                                tmpPlan = this.moveInNeighborFreeCell()
                            } else if(pathLenToOtherAgent === 2 && !this.agentCarriesParcels()){
                                let target = this.translatePlanIntoTarget(BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].slice(0, 1))
                                this.comm.say(JSON.stringify({belief: 'ENDEXCHANGETARGET', target: target}))
                                this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                            }
                            if(tmpPlan[0] === 'error'){
                                this.exchangeMaster = false
                                this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                            } else {
                                this.target = this.translatePlanIntoTarget(tmpPlan)
                                this.plan = tmpPlan
                            }
                        } else {
                            if(this.target.intention === 'error'){
                                this.exchangeMaster = false
                                this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                            } else {
                                tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                                if(tmpPlan[0] === 'error'){
                                    this.exchangeMaster = false
                                    this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                    this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                                } else {
                                    this.target = this.translatePlanIntoTarget(tmpPlan)
                                    this.plan = tmpPlan
                                }
                            }
                        }
                    }
                    
                    if(this.exchangeSlave){
                        let utility = this.decideToIgnoreExchangeAndGetTargetAndPlan()
                        // let utility = [false]
                        if(utility[0]){
                            this.target = utility[1]
                            this.plan = utility[2]
                        } else {
                            if(this.endExchangeTarget.intention !== 'error'){
                            this.target = this.endExchangeTarget
                                if(this.agent.x === this.target.x && this.agent.y === this.target.y){
                                    this.exchangeSlave = false
                                    this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                    this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                                }
                                this.plan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                            } else {
                                tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].concat('pickup')
                                if(tmpPlan[0] === 'error'){
                                    this.exchangeSlave = false
                                    this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                    this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                                } else {
                                    this.target = this.translatePlanIntoTarget(tmpPlan)
                                    this.plan = tmpPlan
                                }
                            }
                        }
                    }
                } else {
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
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }

    decideToIgnoreExchangeAndGetTargetAndPlan(){
        let scoreParcelsCarried = 0
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy === this.agent.id){
                scoreParcelsCarried += parcel[1].reward
            }
        }
        console.log('scoreParcelsCarried: ' + scoreParcelsCarried)
        if(scoreParcelsCarried > 0){
            /*
            L'utility deve essere un misto di:
            - distanza dalla cella di delivery
            - distanza dall'altro agente
            - score che sto portando io
            - score che sta portando l'altro agente
            */
           return [true, new Target(this.agent.x, this.agent.y, 'stayStill', 0), []] // to change into real target and plan
        } else {
            return [false, new Target(-1, -1, 'error', 0), []]
        }
    }

    async sendTargetToOtherAgent(){
        let lastTarget = this.target
        while(true){
            if(this.target.intention !== lastTarget.intention || this.target.x !== lastTarget.x || this.target.y !== lastTarget.y){
                this.comm.say(JSON.stringify({belief: 'TARGETUPDATE', target: this.target}))
                lastTarget = this.target
            }
            await new Promise(res => setImmediate(res))
        }
    }

    async sendScoreParcelsCarriedToOtherAgent(){
        let lastScore = 0
        while(true){
            let newScore = this.getScoreParcelsCarried()
            if(newScore !== lastScore){
                lastScore = newScore
                this.comm.say(JSON.stringify({belief: 'CARRYUPDATE', score: lastScore}))
            }
            await new Promise(res => setImmediate(res))
        }
    }

    checkAllInitialized(){
        return true
    }

    moveInNeighborFreeCell(){
        let xs = [0, -1, 0, 1]
        let ys = [1, 0, -1, 0]
        for(let i = 0; i < 4; i++){
            if(this.agent.x + xs[i] > -1 && this.agent.y + ys[i] > -1 && this.agent.x + xs[i] < this.map.getNRows() && this.agent.y + ys[i] < this.map.getNCols()){
                if(this.map.getMatrix()[this.agent.x + xs[i]][this.agent.y + ys[i]].type !== 0){
                    let free = true
                    for(const agent of this.agents.getMap()){
                        if(agent[1].x === this.agent.x + xs[i] && agent[1].y === this.agent.y + ys[i]){
                            free = false
                        }
                    }
                    if(free){
                        return [this.translateDirection(xs[i], ys[i])]
                    }
                }
            }
        }
        return ['error']
    }

    translateDirection(x, y){
        if(x === 0){
            if(y === 1){
                return 'up'
            }
            return 'down'
        }
        if(x === 1){
            return 'right'
        }
        return 'left'
    }

    calculateExchangeCommonTarget(){
        let tmpPlan = BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)
        if(tmpPlan[0][0] === 'error'){
            return new Target(this.agent.x, this.agent.y, 'error', 0)
        } else {
            if(tmpPlan[0].length % 2 === 0){
                let halfPlanPlus2 = tmpPlan[0].slice(0, ((tmpPlan[0].length - 2) / 2) + 2)
                if(sendLimit){
                    this.comm.say(JSON.stringify({belief: 'TARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                    sendLimit = false
                }
                let halfPlan = tmpPlan[0].slice(0, (tmpPlan[0].length - 2) / 2)
                return this.translatePlanIntoTarget(halfPlan)
            } else {
                let halfPlanPlus2 = tmpPlan[0].slice(0, Math.floor((tmpPlan[0].length - 2) / 2) + 3)
                if(sendLimit){
                    this.comm.say(JSON.stringify({belief: 'TARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                    sendLimit = false
                }
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

    getScoreParcelsCarried(){
        let score = 0
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy === this.agent.id){
                score += parcel[1].reward
            }
        }
        return score
    }
    
    getTargetsIdleMovement(){
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3 && this.map.getMatrix()[row][col].lastSeen > 0){
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