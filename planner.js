import { ManhattanDistance, BFS, PathLengthBFS, readFile, pddlBFS } from "./util.js"
import fetch from 'node-fetch'

let sendLimit = true
setInterval(() => {
    sendLimit = true
}, 10)

class LocalSolver {
    constructor() {
        this.domain = "(define (domain BLOCKS) (:requirements :strips) (:predicates (on ?x ?y) (ontable ?x) (clear ?x) (handempty) (holding ?x) ) (:action pick-up :parameters (?x) :precondition (and (clear ?x) (ontable ?x) (handempty)) :effect (and (not (ontable ?x)) (not (clear ?x)) (not (handempty)) (holding ?x))) (:action put-down :parameters (?x) :precondition (holding ?x) :effect (and (not (holding ?x)) (clear ?x) (handempty) (ontable ?x))) (:action stack :parameters (?x ?y) :precondition (and (holding ?x) (clear ?y)) :effect (and (not (holding ?x)) (not (clear ?y)) (clear ?x) (handempty) (on ?x ?y))) (:action unstack :parameters (?x ?y) :precondition (and (on ?x ?y) (clear ?x) (handempty)) :effect (and (holding ?x) (clear ?y) (not (clear ?x)) (not (handempty)) (not (on ?x ?y)))))",
        this.problem = "(define (problem BLOCKS-4-0) (:domain BLOCKS) (:objects D B A C ) (:INIT (CLEAR C) (CLEAR A) (CLEAR B) (CLEAR D) (ONTABLE C) (ONTABLE A) (ONTABLE B) (ONTABLE D) (HANDEMPTY)) (:goal (AND (ON D C) (ON C B) (ON B A))) )"
        this.baseUrl = "http://localhost:5001"
        this.lamaSolverPath = "/package/lama/solve"
    }
    async solve() {
        let response = await fetch(this.baseUrl + this.lamaSolverPath, {
            method: 'POST',
            body: JSON.stringify({
                domain: this.domain,
                problem: this.problem
            }),
            headers: { 'Content-Type': 'application/json' }
        })
        let solve_request_url = await response.json()
        console.log(solve_request_url);
        response = await fetch(this.baseUrl + solve_request_url['result'], {
            method: 'POST'
        })
        let celery_result = await response.json()
        console.log(celery_result);
        return celery_result
    }
}


class Target{
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention
        this.score = score
    }
}

class Planner{
    constructor(client, map, agent, otherAgent, parcels, agents, comm, enemies, who, control, verbose=false){
        this.client = client
        this.verbose = verbose
        this.who = who
        this.blockStrategy = false
        this.exchangeMaster = false
        this.exchangeSlave = false
        this.endExchangeTarget = new Target(-1, -1, 'error', 0)
        this.map = map
        this.agent = agent
        this.otherAgent = otherAgent
        this.parcels = parcels
        this.agents = agents
        this.enemies = enemies
        this.comm = comm
        this.plan = ['error']
        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
        this.domain = ""
        this.control = control
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
        this.domain = await readFile("./domain.pddl")
        while(true){
            if(this.blockStrategy){
                if(this.checkBlockStrategyStillPossible() && this.control.ready){
                    //this.plan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                    //console.log("1");
                    this.plan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, this.domain, true))[0]
                } else {
                    this.blockStrategy = false
                    this.target = new Target(-1, -1, 'error', 0)
                    this.comm.say(JSON.stringify({belief: 'ENDBLOCKSTRATEGY'}))
                }
            } else if(this.exchangeMaster || this.exchangeSlave){
                let tmpPlan = []

                if(this.exchangeMaster){
                    if(this.endExchangeTarget.intention === 'error'){
                        this.target = this.calculateExchangeCommonTarget()
                        if(this.target.intention === 'error'){
                            this.plan = []
                            this.exchangeMaster = false
                            this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                            this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                        } else {
                            let pathLenToOtherAgent = PathLengthBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                            if(pathLenToOtherAgent < 3){
                                if(pathLenToOtherAgent === 2 && this.agentCarriesParcels() && this.control.ready){
                                    //tmpPlan = BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].slice(0, 1)
                                    //console.log("2");
                                    tmpPlan = (await pddlBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, this.domain, true))[0].slice(0, 1)
                                } else if (pathLenToOtherAgent === 1 && this.agentCarriesParcels()){
                                    tmpPlan = ['putdown']
                                } else if(pathLenToOtherAgent === 1 && !this.agentCarriesParcels()){
                                    tmpPlan = this.moveInNeighborFreeCell()
                                } else if(pathLenToOtherAgent === 2 && !this.agentCarriesParcels() && this.control.ready){
                                    //let target = this.translatePlanIntoTarget(BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].slice(0, 1))
                                    //console.log("3");
                                    let target = this.translatePlanIntoTarget((await pddlBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, this.domain, true))[0].slice(0, 1))
                                    this.endExchangeTarget = target
                                    this.comm.say(JSON.stringify({belief: 'ENDEXCHANGETARGET', target: target}))
                                }

                                if (this.control.ready) {
                                    if(tmpPlan[0] === 'error'){
                                        this.exchangeMaster = false
                                        this.plan = []
                                        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
                                        this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                        this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                                    } else {
                                        this.target = this.translatePlanIntoTarget(tmpPlan)
                                        this.plan = tmpPlan
                                    }
                                }
                            } else {
                                if (this.control.ready) {
                                    //tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                                    tmpPlan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, this.domain, true))[0]
                                    if(tmpPlan[0] === 'error'){
                                        this.plan = []
                                        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
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
                    } else {
                        this.target = new Target(this.agent.x, this.agent.y, 'exchange', 0)
                        this.plan = tmpPlan
                    }
                }
                
                if(this.exchangeSlave){
                    if(this.endExchangeTarget.intention !== 'error'){
                        if (this.control.ready) {
                            //tmpPlan = BFS(this.agent.x, this.agent.y, this.endExchangeTarget.x, this.endExchangeTarget.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].concat('pickup')
                            //console.log("4");
                            tmpPlan = (await pddlBFS(this.agent.x, this.agent.y, this.endExchangeTarget.x, this.endExchangeTarget.y, this.map, this.agents, this.agent, this.otherAgent, this.domain, true))[0].concat('pickup')
                            if(this.agent.x === this.endExchangeTarget.x && this.agent.y === this.endExchangeTarget.y){
                                this.exchangeSlave = false
                                this.plan = []
                                this.target = new Target(this.agent.x, this.agent.y, 'exchange', 0)
                                this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                            } else if(tmpPlan[0] !== 'error'){
                                this.target = this.translatePlanIntoTarget(tmpPlan)
                                this.target.intention = 'exchange'
                                this.plan = tmpPlan
                            }
                        }
                    } else {
                        if (this.control.ready) {
                            //tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                            //console.log("5");
                            tmpPlan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, this.domain, true))[0]
                            if(tmpPlan[0] === 'error'){
                                this.exchangeSlave = false
                                this.plan = []
                                this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
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
                let block = [false]
                if(this.who === 'one'){
                    block = this.checkBlockStrategy()
                }
                if(block[0]){
                    let targetThisAgent = block[1]
                    let targetOtherAgent = block[2]

                    this.blockStrategy = true
                    this.target = targetThisAgent
                    this.comm.say(JSON.stringify({belief: 'BLOCKSTRATEGY', target: targetOtherAgent}))
                } else {
                    let targets = []
    
                    targets = this.getTargetsIdleMovement().concat(targets)
                    if(this.agentKnowsParcels() || this.agentCarriesParcels()){
                        targets = this.getTargetsWithUtility().concat(targets)
                    }
    
                    let found = false
                    let count = 0
                    while (!found && count < targets.length) {
                        let tmpPlan = []
                        let target = targets[count]
                        if(this.checkExchange(target)){
                            if(this.exchangeUtility()){
                                this.exchangeMaster = true
                                this.plan = []
                                this.target = new Target(this.agent.x, this.agent.y, 'exchange', 0)
                                this.comm.say(JSON.stringify({belief: 'STARTEXCHANGE'}))
                                found = true
                            } else {
                                if (this.control.ready) {
                                    this.target = new Target(this.otherAgent.x, this.otherAgent.y, 'exchange', 0)
                                    //this.plan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, true)[0]
                                    //console.log("6");
                                    this.plan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, this.domain, true))[0]
                                    found = true
                                }
                            }
                        } else {
                            tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent)
                            //console.log("7",this.agent.x, this.agent.y, target.x, target.y);
                                if(tmpPlan[0][0] !== 'error'){
                                    if (this.control.ready) {
                                        tmpPlan = (await pddlBFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent, this.domain))
                                        this.plan = tmpPlan[0]
                                        this.target = target
                                        found = true
                                    }
                                }
                        }
                        count++
                    }
    
                    if(!found){
                        this.target = new Target(this.agent.x, this.agent.y, 'targetNotFound', 0)
                        this.plan = []
                    } else {
                        if (this.control.ready) {
                            if(this.target.intention === 'pickup'){
                                this.plan = this.plan.concat(['pickup'])
                            } else if(this.target.intention === 'delivery'){
                                this.plan = this.plan.concat(['putdown'])
                            }
                        }
                    }
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }

    checkBlockStrategy(){
        if(this.enemies.enemyOne.id !== undefined && this.enemies.enemyTwo.id !== undefined){
            if(this.enemies.enemyOne.visible && this.enemies.enemyTwo.visible){
                if((this.enemies.enemyOne.score + this.enemies.enemyTwo.score) < (this.agent.score + this.otherAgent.score)){
                    return this.mapHasOnlyTwoDeliveryCells()
                }
            }
        }
        return [false, new Target(-1, -1, 'error', 0), new Target(-1, -1, 'error', 0)]
    }

    checkBlockStrategyStillPossible(){
        return (this.enemies.enemyOne.score + this.enemies.enemyTwo.score) < (this.agent.score + this.otherAgent.score)
    }

    mapHasOnlyTwoDeliveryCells(){
        let n = 0
        let targetOne = new Target(-1, -1, 'error', 0)
        let targetTwo = new Target(-1, -1, 'error', 0)
        for(let i = 0; i < this.map.getNRows(); i++){
            for(let j = 0; j < this.map.getNCols(); j++){
                if(this.map.getMatrix()[i][j].type === 2){
                    n += 1
                    if(targetOne.intention === 'error'){
                        targetOne = new Target(i, j, 'block', 0)
                    } else if(targetTwo.intention === 'error'){
                        targetTwo = new Target(i, j, 'block', 0)
                    }
                }
            }
        }

        if(n === 1){
            let pathLengthToDeliveryThisAgent = PathLengthBFS(this.agent.x, this.agent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)
            let pathLengthToDeliveryOtherAgent = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)

            let pathLengthToDeliveryEnemyOne = PathLengthBFS(this.enemies.enemyOne.x, this.enemies.enemyOne.y, targetOne.x, targetOne.y, this.map, this.agents)
            let pathLengthToDeliveryEnemyTwo = PathLengthBFS(this.enemies.enemyTwo.x, this.enemies.enemyTwo.y, targetOne.x, targetOne.y, this.map, this.agents)

            if(pathLengthToDeliveryThisAgent <= pathLengthToDeliveryOtherAgent){
                if(pathLengthToDeliveryThisAgent < pathLengthToDeliveryEnemyOne && pathLengthToDeliveryThisAgent < pathLengthToDeliveryEnemyTwo){
                    return [true, targetOne, new Target(this.otherAgent.x, this.otherAgent.y, 'block', 0)]
                } else {
                    return [false, new Target(-1, -1, 'error', 0), new Target(-1, -1, 'error', 0)]
                }
            } else {
                if(pathLengthToDeliveryOtherAgent < pathLengthToDeliveryEnemyOne && pathLengthToDeliveryOtherAgent < pathLengthToDeliveryEnemyTwo){
                    return [true, new Target(this.agent.x, this.agent.x, 'block', 0), targetOne]
                } else {
                    return [false, new Target(-1, -1, 'error', 0), new Target(-1, -1, 'error', 0)]
                }
            }

        } else if(n === 2){
            let thisAgentToTargetOne = PathLengthBFS(this.agent.x, this.agent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let thisAgentToTargetTwo = PathLengthBFS(this.agent.x, this.agent.y, targetTwo.x, targetTwo.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let otherAgentToTargetOne = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let otherAgentToTargetTwo = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, targetTwo.x, targetTwo.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let enemyOneToTargetOne = PathLengthBFS(this.enemies.enemyOne.x, this.enemies.enemyOne.y, targetOne.x, targetOne.y, this.map, this.agents)[0]
            let enemyOneToTargetTwo = PathLengthBFS(this.enemies.enemyOne.x, this.enemies.enemyOne.y, targetTwo.x, targetTwo.y, this.map, this.agents)[0]
            let enemyTwoToTargetOne = PathLengthBFS(this.enemies.enemyTwo.x, this.enemies.enemyTwo.y, targetOne.x, targetOne.y, this.map, this.agents)[0]
            let enemyTwoToTargetTwo = PathLengthBFS(this.enemies.enemyTwo.x, this.enemies.enemyTwo.y, targetTwo.x, targetTwo.y, this.map, this.agents)[0]

            if(thisAgentToTargetOne < enemyOneToTargetOne && thisAgentToTargetOne < enemyTwoToTargetOne){
                if(otherAgentToTargetTwo < enemyOneToTargetTwo && otherAgentToTargetTwo < enemyTwoToTargetTwo){
                    return [true, targetOne, targetTwo]
                }
            }
            if(thisAgentToTargetTwo < enemyOneToTargetTwo && thisAgentToTargetTwo < enemyTwoToTargetTwo){
                if(otherAgentToTargetOne < enemyOneToTargetOne && otherAgentToTargetOne < enemyTwoToTargetOne){
                    return [true, targetTwo, targetOne]
                }
            }

            return [false, new Target(-1, -1, 'error', 0), new Target(-1, -1, 'error', 0)]
        } else {
            return [false, new Target(-1, -1, 'error', 0), new Target(-1, -1, 'error', 0)]
        }
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
                    this.comm.say(JSON.stringify({belief: 'EXCHANGETARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                    sendLimit = false
                }
                let halfPlan = tmpPlan[0].slice(0, (tmpPlan[0].length - 2) / 2)
                return this.translatePlanIntoTarget(halfPlan)
            } else {
                let halfPlanPlus2 = tmpPlan[0].slice(0, Math.floor((tmpPlan[0].length - 2) / 2) + 3)
                if(sendLimit){
                    this.comm.say(JSON.stringify({belief: 'EXCHANGETARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
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
    checkExchange(target){
        let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent, true)
        return target.intention === 'delivery' && tmpPlan[0][0] !== 'error' && tmpPlan[1]
    }
    exchangeUtility(){
        // score delle parcelle dell'agente a cui viene richiesto lo scambio
        let scoreParcelsCarriedOtherAgent = this.otherAgent.scoreParcelsCarried

        if(scoreParcelsCarriedOtherAgent === 0){
            return true
        } else {
            // score delle parcelle tenute dal richiedente
            let scoreParcelsCarriedThisAgent = this.getScoreParcelsCarried()
            // distanza tra il richiedente e l'agente che riceve la richiesta di scambio
            let distanceToTargetThisAgent = PathLengthBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
            // distanza tra l'altro agente e il suo target (con intention che è per forza delivery)
            let distanceToTargetOtherAgent = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, this.otherAgent.target.x, this.otherAgent.target.y, this.map, this.agents, this.otherAgent, this.agent, false)[0]

            let scoreThisAgent = Math.pow(scoreParcelsCarriedThisAgent, 1) / Math.pow(distanceToTargetThisAgent, 2)
            let scoreOtherAgent = Math.pow(scoreParcelsCarriedOtherAgent, 1) / Math.pow(distanceToTargetOtherAgent, 2)
            return scoreThisAgent > scoreOtherAgent
        }
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
        if(x === this.otherAgent.target.x && y === this.otherAgent.target.y){
            return 0
        }
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

export { Planner, LocalSolver }