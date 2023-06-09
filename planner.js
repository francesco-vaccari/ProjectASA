import { ManhattanDistance, BFS, PathLengthBFS, readFile, pddlBFS } from "./util.js"
import fetch from 'node-fetch'

let sendLimit = true // this avoids to send too many messages, it is used in the function Planner.calculateExchangeCommonTarget
setInterval(() => {
    sendLimit = true
}, 100)


class Target{ // represents the target/intention of the agent
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention // can be 'error', 'pickup', 'putdown', 'exchange', 'idle', 'block
        this.score = score // score of the intention, used to sort targets and pick the best one
    }
}

class Planner{ // in this class there is all the logic regarding choice of intentions and plan generation
    constructor(client, map, agent, otherAgent, parcels, agents, comm, enemies, who, control, verbose=false){ // takes as input all the beliefs
        this.client = client
        this.verbose = verbose
        this.control = control
        this.who = who // 'one' or 'two', used to determine which agent checks if the blocking strategy is possible
        this.blockStrategy = false // if true, the agents are in the blocking strategy intention
        this.exchangeMaster = false // if true, the agent is in the exchange intention, and is the one that started it
        this.exchangeSlave = false // if true, the agent is in the exchange intention, and is the one that received the request
        this.endExchangeTarget = new Target(-1, -1, 'error', 0) // LAST target of the exchange intention
        this.map = map
        this.agent = agent
        this.otherAgent = otherAgent
        this.parcels = parcels
        this.agents = agents
        this.enemies = enemies
        this.comm = comm
        this.plan = ['error'] // plan of actions to execute (for BFS version)
        this.pddlPlan = [] // plan of actions to execute (for PDDL version)
        this.target = new Target(this.agent.x, this.agent.y, 'error', 0) // target/intention of the agent
        this.domain = ""
        this.chooseIntentions() // main loop of the planner, decides the intentions with utilities and sets targets
        this.sendTargetToOtherAgent() // when the target/intention is updated, a message is sent to the other agent
        this.sendScoreParcelsCarriedToOtherAgent() // when the number of parcels carried is updated, a message is sent to the other agent
        this.startTrackingTarget() // tracks target changes, and when the target changes, computes and updates the plan
        if(this.verbose){
            setInterval(() => {
                console.log('['+this.agent.name+']\tTARGET', this.target.x, this.target.y, this.target.intention)
                // console.log('PLAN', this.plan)
            }, 200)
        }
    }
    async chooseIntentions(){ // main loop of the planner
        this.domain = await readFile("./domain.pddl")
        while(true){
            if(this.blockStrategy){ // if the agents are in the blocking strategy intention
                if(this.checkBlockStrategyStillPossible()){ // if our agents are still up in score
                    this.plan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, false)[0]
                } else { // if our score is less than the score of enemies, exit from the blocking strategy
                    this.blockStrategy = false
                    this.target = new Target(-1, -1, 'error', 0)
                    this.comm.say(JSON.stringify({belief: 'ENDBLOCKSTRATEGY'}))
                }
            } else if(this.exchangeMaster || this.exchangeSlave){ // if the agents are in the exchange intention
                let tmpPlan = []

                if(this.exchangeMaster){ // if the agent is the one that started the exchange intention
                    if(this.endExchangeTarget.intention === 'error'){ // if the last target of the exchange intention is still not set (exchange not done yet)
                        this.target = this.calculateExchangeCommonTarget() // compute the meet point of the exchange intention
                        if(this.target.intention === 'error'){ // handle errors in the computation and exit from the exchange intention
                            this.plan = []
                            this.exchangeMaster = false
                            this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                            this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                        } else { // if a meet point is found, the agents will start moving towards it
                            let pathLenToOtherAgent = PathLengthBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                            if(pathLenToOtherAgent < 3){ // if the agents are close enough, the exchange can start
                                if(pathLenToOtherAgent === 2 && this.agentCarriesParcels()){ // when agents are in position the master moves one step closer
                                    tmpPlan = BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].slice(0, 1)
                                } else if (pathLenToOtherAgent === 1 && this.agentCarriesParcels()){ // then drops the parcels
                                    tmpPlan = ['putdown']
                                } else if(pathLenToOtherAgent === 1 && !this.agentCarriesParcels()){ // then moves away
                                    tmpPlan = this.moveInNeighborFreeCell()
                                } else if(pathLenToOtherAgent === 2 && !this.agentCarriesParcels()){ // and communicates where the parcels are on the ground to the other agent
                                    let target = this.translatePlanIntoTarget(BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].slice(0, 1))
                                    this.endExchangeTarget = target
                                    this.comm.say(JSON.stringify({belief: 'ENDEXCHANGETARGET', target: target}))
                                }

                                if(tmpPlan[0] === 'error'){ // if in the code above there were errors in finding a target, exit from the exchange intention
                                    this.exchangeMaster = false
                                    this.plan = []
                                    this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
                                    this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                                    this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                                } else { // else set the target and the BFS plan
                                    this.target = this.translatePlanIntoTarget(tmpPlan)
                                    this.plan = tmpPlan
                                }
                            } else { // if the agents are still moving towards the meet point, keep moving
                                tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                                if(tmpPlan[0] === 'error'){ // handle errors and exit from the exchange intention
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
                    } else {
                        // the target is set to the position of the agent itself when the master is waiting for the other agent to pick 
                        // up the parcels left on the ground
                        this.target = new Target(this.agent.x, this.agent.y, 'exchange', 0)
                        this.plan = tmpPlan
                    }
                }
                
                if(this.exchangeSlave){ // if the agent is the one that received the exchange intention request
                    if(this.endExchangeTarget.intention !== 'error'){ // if the master has left the parcels on the ground at the meet point
                        tmpPlan = BFS(this.agent.x, this.agent.y, this.endExchangeTarget.x, this.endExchangeTarget.y, this.map, this.agents, this.agent, this.otherAgent, true)[0].concat('pickup')
                        if(this.agent.x === this.endExchangeTarget.x && this.agent.y === this.endExchangeTarget.y){
                            // if the agent is on the parcels (position comunicated by the master) it picks them up and ends the exchange
                            this.exchangeSlave = false
                            this.plan = []
                            this.target = new Target(this.agent.x, this.agent.y, 'exchange', 0)
                            this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                            this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'})) // communicate the end of the exchange to the master
                        } else if(tmpPlan[0] !== 'error'){ // else keep moving towards the parcels left on the ground
                            this.target = this.translatePlanIntoTarget(tmpPlan)
                            this.target.intention = 'exchange'
                            this.plan = tmpPlan
                        }
                    } else { // if the master has not left the parcels on the ground yet, keep moving towards the meet point
                        tmpPlan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                        if(tmpPlan[0] === 'error'){ // handle errors and exit from the exchange intention
                            this.exchangeSlave = false
                            this.plan = []
                            this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
                            this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                            this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                        } else { // keep moving towards the meet point
                            this.target = this.translatePlanIntoTarget(tmpPlan)
                            this.plan = tmpPlan
                        }
                    }
                }
                

            } else { // default behavior, similar to the single-agent architecture
                let block = [false]
                if(this.who === 'one'){ // if the agent is the one that has to check if the blocking strategy is possible
                    block = this.checkBlockStrategy() // checks if the blocking strategy is possible
                }
                if(block[0]){ // if the blocking strategy is possible
                    let targetThisAgent = block[1] // set the target and intention of this agent
                    let targetOtherAgent = block[2] // set the target and intention of the other agent

                    this.blockStrategy = true // next iteration of the planner the agent will be in the blocking strategy
                    this.target = targetThisAgent
                    this.comm.say(JSON.stringify({belief: 'BLOCKSTRATEGY', target: targetOtherAgent})) // and communicate the decision and the target
                } else { // if the blocking strategy is not possible
                    let targets = []
    
                    targets = this.getTargetsIdleMovement().concat(targets) // get the targets with intention 'idle', searching for parcels
                    if(this.agentKnowsParcels() || this.agentCarriesParcels()){ // if the agent knows where the parcels are or is carrying some
                        targets = this.getTargetsWithUtility().concat(targets) // get the targets with intention 'pickup' or 'putdown'
                    }
    
                    let found = false
    
                    for(const target of targets){
                        if(!found){ // keep searching if a valid target/intention has not been found yet
                            let tmpPlan = []
                            if(this.checkExchange(target)){ // check if the exchange would be necessary
                                if(this.exchangeUtility()){ // check if the exchange would be accepted by the other agent with the utility
                                    this.exchangeMaster = true // if yes, set the exchange intention and target
                                    this.plan = []
                                    this.target = new Target(this.agent.x, this.agent.y, 'exchange', 0)
                                    this.comm.say(JSON.stringify({belief: 'STARTEXCHANGE'}))
                                    found = true
                                } else { // if the exchange is necessary but not accepted, start moving towards the other agent
                                    this.target = new Target(this.otherAgent.x, this.otherAgent.y, 'exchange', 0) // set the target as other agent coordinates
                                    this.plan = BFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, true)[0]
                                    found = true
                                }
                            } else { // if the exchange is not necessary checks if the target is reachable
                                tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent)
                                if(tmpPlan[0][0] !== 'error'){ // if the target is reachable, set the target and intention
                                    this.plan = tmpPlan[0]
                                    this.target = target
                                    found = true
                                }
                            }
                        }
                    }
    
                    if(!found){ // if no valid target/intention has been found, set 'targetNotFound' as target and intention
                        this.target = new Target(this.agent.x, this.agent.y, 'targetNotFound', 0)
                        this.plan = []
                    } else { // if a valid target/intention has been found, concatenate to the BFS plan the action to perform
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

    checkBlockStrategy(){ // checks if the blocking strategy is possible
        if(this.enemies.enemyOne.id !== undefined && this.enemies.enemyTwo.id !== undefined){ // needs enemies to be initialized
            if(this.enemies.enemyOne.visible && this.enemies.enemyTwo.visible){ // enemies have to be both visible
                if((this.enemies.enemyOne.score + this.enemies.enemyTwo.score) < (this.agent.score + this.otherAgent.score)){
                    // if the score of the enemies is lower than the score of our agents
                    return this.mapHasOnlyTwoDeliveryCells() // check if the map has only 2 delivery cells that can be blocked
                }
            }
        }
        return [false, new Target(-1, -1, 'error', 0), new Target(-1, -1, 'error', 0)] // else the blocking strategy is not possible
    }

    checkBlockStrategyStillPossible(){ // this is called when already in the blocking strategy, as a double check
        return (this.enemies.enemyOne.score + this.enemies.enemyTwo.score) < (this.agent.score + this.otherAgent.score)
    }

    mapHasOnlyTwoDeliveryCells(){ // checks if the map has only 2 delivery cells that can be blocked
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

        if(n === 1){ // if there is only one delivery cell, the closest agent will block it while the other agent will stand still
            let pathLengthToDeliveryThisAgent = PathLengthBFS(this.agent.x, this.agent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)
            let pathLengthToDeliveryOtherAgent = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)

            let pathLengthToDeliveryEnemyOne = PathLengthBFS(this.enemies.enemyOne.x, this.enemies.enemyOne.y, targetOne.x, targetOne.y, this.map, this.agents)
            let pathLengthToDeliveryEnemyTwo = PathLengthBFS(this.enemies.enemyTwo.x, this.enemies.enemyTwo.y, targetOne.x, targetOne.y, this.map, this.agents)

            // also need to check that our agents are closer to the delivery cell than the enemies
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

        } else if(n === 2){ // if there are two delivery cells
            let thisAgentToTargetOne = PathLengthBFS(this.agent.x, this.agent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let thisAgentToTargetTwo = PathLengthBFS(this.agent.x, this.agent.y, targetTwo.x, targetTwo.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let otherAgentToTargetOne = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, targetOne.x, targetOne.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let otherAgentToTargetTwo = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, targetTwo.x, targetTwo.y, this.map, this.agents, this.agent, this.otherAgent)[0]
            let enemyOneToTargetOne = PathLengthBFS(this.enemies.enemyOne.x, this.enemies.enemyOne.y, targetOne.x, targetOne.y, this.map, this.agents)[0]
            let enemyOneToTargetTwo = PathLengthBFS(this.enemies.enemyOne.x, this.enemies.enemyOne.y, targetTwo.x, targetTwo.y, this.map, this.agents)[0]
            let enemyTwoToTargetOne = PathLengthBFS(this.enemies.enemyTwo.x, this.enemies.enemyTwo.y, targetOne.x, targetOne.y, this.map, this.agents)[0]
            let enemyTwoToTargetTwo = PathLengthBFS(this.enemies.enemyTwo.x, this.enemies.enemyTwo.y, targetTwo.x, targetTwo.y, this.map, this.agents)[0]

            // check if our agents are closer to the delivery cells than the enemies, and set the targets accordingly
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

    moveInNeighborFreeCell(){ // method used to move the agent a step back after putting the parcels on the ground in the exchange intention
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
    translateDirection(x, y){ // method used to translate the direction of the movement into a string
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
    calculateExchangeCommonTarget(){ // method used to calculate the meet point in the exchange intention
        // first compute the path to the other agent
        let tmpPlan = BFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)
        if(tmpPlan[0][0] === 'error'){ // if the path is not found, return an error target which will make the agents exit the exchange intention
            return new Target(this.agent.x, this.agent.y, 'error', 0)
        } else {
            if(tmpPlan[0].length % 2 === 0){ // if the path length is even
                let halfPlanPlus2 = tmpPlan[0].slice(0, ((tmpPlan[0].length - 2) / 2) + 2)
                if(sendLimit){
                    // communicate the exchange meet point to the other agent
                    this.comm.say(JSON.stringify({belief: 'EXCHANGETARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                    sendLimit = false
                }
                let halfPlan = tmpPlan[0].slice(0, (tmpPlan[0].length - 2) / 2)
                return this.translatePlanIntoTarget(halfPlan)
            } else { // if the path length is odd
                let halfPlanPlus2 = tmpPlan[0].slice(0, Math.floor((tmpPlan[0].length - 2) / 2) + 3)
                if(sendLimit){
                    // communicate the exchange meet point to the other agent
                    this.comm.say(JSON.stringify({belief: 'EXCHANGETARGET', target: this.translatePlanIntoTarget(halfPlanPlus2)}))
                    sendLimit = false
                }
                let halfPlan = tmpPlan[0].slice(0, Math.floor((tmpPlan[0].length - 2) / 2) + 1)
                return this.translatePlanIntoTarget(halfPlan)
            }
        }
    }

    async startTrackingTarget(){ // in this function the PPDL plan is computed when the target changes, as a result of the logic in the main loop
        let lastTarget = this.target
        let again = false
        let once = true
        setInterval(() => { // the plan is computed when the target changes of after 3.5 seconds
            again = true
        }, 3500)
        while(true){
            if(this.control.ready){
                if(this.exchangeMaster || this.exchangeSlave){ // if the agents are in the exchnage intention
                    if(once){
                        once = false
                        setTimeout(() => { // after 11 seconds the agents exit the exchange intention, this means an error occured
                            this.exchangeSlave = false
                            this.exchangeMaster = false
                            this.plan = []
                            this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
                            this.endExchangeTarget = new Target(-1, -1, 'error', 0)
                            this.comm.say(JSON.stringify({belief: 'ENDEXCHANGE'}))
                            once = true
                        }, 11000)
                    }
                    this.pddlPlan = []
                    if(this.exchangeMaster){ // if the agent is the master
                        if(this.exchangeMaster.intention !== 'error'){ // and the LAST intention is not been set yet (means no parcels were put on the ground yet)
                            let pathLenToOtherAgent = PathLengthBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
                            if(pathLenToOtherAgent == 1 && this.agentCarriesParcels()){ // check if the agent is in the meet point
                                this.pddlPlan = ['putdown'] // and putdown the parcels
                                // this.pddlPlan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, this.domain, false))[0]
                            } else { // otherwise keep moving towards the meet point
                                this.pddlPlan = []
                                this.pddlPlan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, this.domain, false))[0]
                            }
                        }
                    }
                    if(this.exchangeSlave){ // if the agent is the slave
                        if(this.endExchangeTarget.intention !== 'error'){ // if the master put on the ground its parcels, move to them and pick them up
                            this.pddlPlan = []
                            this.pddlPlan = (await pddlBFS(this.agent.x, this.agent.y, this.endExchangeTarget.x, this.endExchangeTarget.y, this.map , this.agents, this.agent, this.otherAgent, this.domain, false))[0]
                            this.pddlPlan = this.pddlPlan.concat(['pickup'])
                        } else {
                            this.pddlPlan = []
                            this.pddlPlan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, this.domain, false))[0]
                        }
                    }
                } else { // if the agents are not in the exchange intention (could be in block intention)
                    this.pddlPlan = []
                    // if the target has changed compute a new PDDL plan
                    if(this.target.intention !== lastTarget.intention || this.target.x !== lastTarget.x || this.target.y !== lastTarget.y || again){
                        again = false
                        this.pddlPlan = []
                        this.pddlPlan = (await pddlBFS(this.agent.x, this.agent.y, this.target.x, this.target.y, this.map , this.agents, this.agent, this.otherAgent, this.domain, false))[0]
                        if(this.target.intention === 'delivery'){ // and concatenate to the plan the correct action to execute
                            this.pddlPlan = this.pddlPlan.concat(['putdown'])
                        } else if(this.target.intention === 'pickup'){
                            this.pddlPlan = this.pddlPlan.concat(['pickup'])
                        }
                        lastTarget = this.target
                    }
            }
        }
            await new Promise(res => setImmediate(res))
        }
    }

    translatePlanIntoTarget(plan){ // this function is used to translate a plan into a target
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
    checkExchange(target){ // checks whether the exchange is necessary, which is when the target is a delivery cell and the path to it is blocked only by the ally agent
        let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent, true)
        return target.intention === 'delivery' && tmpPlan[0][0] !== 'error' && tmpPlan[1]
    }
    exchangeUtility(){ // utility to verify whether the other agent accepts the exchange request or not
        // score of parcels carried by the agent that receives the exchange request
        let scoreParcelsCarriedOtherAgent = this.otherAgent.scoreParcelsCarried

        if(scoreParcelsCarriedOtherAgent === 0){ // if the other agent carries no parcels, always accept the exchange
            return true
        } else {
            // score of parcels of the requester
            let scoreParcelsCarriedThisAgent = this.getScoreParcelsCarried()
            // distance between agents
            let distanceBetweenAgents = PathLengthBFS(this.agent.x, this.agent.y, this.otherAgent.x, this.otherAgent.y, this.map, this.agents, this.agent, this.otherAgent, true)[0]
            // distance from other agent to its target
            let distanceFromOtherAgentToItsTarget = PathLengthBFS(this.otherAgent.x, this.otherAgent.y, this.otherAgent.target.x, this.otherAgent.target.y, this.map, this.agents, this.otherAgent, this.agent, false)[0]

            // utility formula
            let scoreThisAgent = Math.pow(scoreParcelsCarriedThisAgent, 1) / Math.pow(distanceBetweenAgents, 2)
            let scoreOtherAgent = Math.pow(scoreParcelsCarriedOtherAgent, 1) / Math.pow(distanceFromOtherAgentToItsTarget, 2)
            return scoreThisAgent > scoreOtherAgent
        }
    }
    getScoreParcelsCarried(){ // function to compute the score of the parcels carried by the agent
        let score = 0
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy === this.agent.id){
                score += parcel[1].reward
            }
        }
        return score
    }
    async sendTargetToOtherAgent(){ // when the target changes, this function sends the updated target to the other agent
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
        // when the score of the parcels carried by the agent changes, this function sends the updated score to the other agent
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
    getScoreParcelsCarried(){ // function to compute the score of the parcels carried by the agent
        let score = 0
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy === this.agent.id){
                score += parcel[1].reward
            }
        }
        return score
    }
    getTargetsIdleMovement(){ // function to get targets with 'idle' intention, searching for parcels
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){ // iterate through the map cells
                if(this.map.getMatrix()[row][col].type === 3 && this.map.getMatrix()[row][col].lastSeen > 0){
                    // if a cell can spawn parcels set target score as the lastSeen attribute
                    let tempTarget = new Target(row, col, 'idle', this.map.getMatrix()[row][col].lastSeen)
                    targets.push(tempTarget)
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1) // sort targets by score
        return targets
    }
    getTargetsWithUtility(){ // function to get targets with 'pickup' or 'delivery' intention
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){ // iterate through the map cells
                if(this.map.getMatrix()[row][col].type === 3 || this.map.getMatrix()[row][col].type === 1){
                    // if a cell can spawn parcels or is a normal cell, set target score as the utility of the cell
                    let score = this.getNormalCellUtility(row, col)
                    if(score > 0){
                        targets.push(new Target(row, col, 'pickup', score))
                    }
                } else if(this.map.getMatrix()[row][col].type === 2){
                    // if a cell is a delivery cell, set target score as the utility of the cell
                    let score = this.getDeliveryCellUtility(row, col)
                    if(score > 0){
                        targets.push(new Target(row, col, 'delivery', score))
                    }
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1) // sort all targets by score
        return targets
    }
    getNormalCellUtility(x, y){ // function to compute the utility of a spawning or normal cell
        if(x === this.otherAgent.target.x && y === this.otherAgent.target.y){ // if the other agent is going to this cell, return 0
            return 0
        }
        let minDistanceToBorder = 10000000 // distance from the cell to the nearest delivery cell
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

        let parcelsRewardInCell = 0 // total of rewards of parcels in this cell
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
                parcelsRewardInCell += parcel[1].reward
            }
        }

        let distanceToAgent = 1 // distance from the cell to the agent
        if(parcelsRewardInCell != 0){
            distanceToAgent =  Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents, this.agent, this.otherAgent)[0], 0.1)
        }

        let enemiesProximity = 1 // scaling factor to discourage the agent to go to a cell near enemies
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
    getDeliveryCellUtility(x, y){ // function to compute the utility of a delivery cell
        let scoreParcelsCarriedByAgent = 0 // total of rewards of parcels carried by the agent
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == this.agent.id){
                scoreParcelsCarriedByAgent += parcel[1].reward
            }
        }

        let distanceToAgent = 1 // distance from the cell to the agent
        if(scoreParcelsCarriedByAgent != 0){
            distanceToAgent = Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents, this.agent, this.otherAgent)[0], 0.1)
        }

        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
    }
    agentKnowsParcels(){ // returns true if the agent knows where there at least one parcel is
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == null){
                return true
            }
        }
        return false
    }
    agentCarriesParcels(){ // returns true if the is carring parcels
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
    getPddlPlan(){
        return this.pddlPlan
    }
}

export { Planner }