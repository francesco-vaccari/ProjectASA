import { AgentsManager, GameMap, ParcelsManager, You } from "./beliefs.js";
import { ManhattanDistance, BFS, PathLengthBFS, readFile } from "./util.js";
import { onlineSolver, PddlProblem, Beliefset } from "@unitn-asa/pddl-client";
import chalk from "chalk"

class Planner{
    /**
     * 
     * @param {GameMap} map 
     * @param {AgentsManager} agentsManager 
     * @param {ParcelsManager} parcelsManager 
     * @param {You} agent 
     * @param {boolean} verbose 
     */
    constructor(map, agentsManager, parcelsManager, agent, control, verbose=false){
        setTimeout(async () => {
            this.n_rows = map.getRows()
            this.n_cols = map.getCols()
            this.map = []
            this.scoreMap = []
            this.domain = await readFile('./domain.pddl' );
            this.problem = null
            this.baseBeliefset = new Beliefset()
            this.plan = []
            this.control = control
            this.verbose = verbose

            let tmpCell,tmpValue;

            for (let i = 0; i < this.n_rows; i++){
                this.map.push([])
                this.scoreMap.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.map[i].push(map.getMatrix()[i][j]) //Initialize map
                    this.scoreMap[i].push(0) //Initialize scoreMap
                    if (map.getMatrix()[i][j] != 0) {
                        this.baseBeliefset.declare("cell c_" + i + "_" + j) //pddl cell initialization
                    }
                }
            }

            for (const cell of this.baseBeliefset.objects) { //pddl cell edges initialization
                tmpCell = cell.split("_")
                for (let i = -1; i < 2; i+=2) {
                    tmpValue = this.map[Number.parseInt(tmpCell[1]) + i]
                    tmpValue = tmpValue != undefined ? tmpValue[tmpCell[2]] : undefined
                    if (tmpValue != undefined && tmpValue != 0) {
                        this.baseBeliefset.declare("near " + cell + " c_" + (Number.parseInt(tmpCell[1]) + i) + "_" + tmpCell[2])
                    }
                    tmpValue =  this.map[tmpCell[1]]
                    tmpValue = tmpValue != undefined ? tmpValue[Number.parseInt(tmpCell[2]) + i] : undefined
                    if (tmpValue != undefined && tmpValue != 0) {
                        this.baseBeliefset.declare("near " + cell + " c_" + (tmpCell[1]) + "_" + (Number.parseInt(tmpCell[2]) + i))
                    }
                }
            }

            if(this.verbose){
                console.log('ScoreMap initialized')
            }

            this.startPlanning(map, agentsManager, parcelsManager, agent)
            
            if(this.verbose){
                setInterval(() => {
                    this.print(agent)
                    console.log(this.intention)
                    // console.log(this.plan)
                }, 100)
            }
        }, 900)
    }

    normalCellHeuristic(x, y, map, agent, parcelsManager, agentsManager){
        let minDistanceToBorder = 10000000
        let borderx = undefined
        let bordery = undefined
        for (let i = 0; i < this.n_rows; i++){
            for(let j = 0; j < this.n_cols; j++){
                if(this.map[i][j] === 2){
                    // let tempDist = BFS(x, y, i, j, map).length
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
        for (const parcel of parcelsManager.parcels.elements){
            if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
                // if(parcel[1].x == agent.x && parcel[1].y == agent.y){
                //     parcelsRewardInCell += 1000000
                // }
                parcelsRewardInCell += parcel[1].reward
            }
        }

        let distanceToAgent = 1
        if(parcelsRewardInCell != 0){
            // distanceToAgent = ManhattanDistance(x, y, agent.x, agent.y)
            distanceToAgent =  Math.max(PathLengthBFS(x, y, agent.x, agent.y, map), 0.1)
        }


        // let enemiesProximity = 0
        // let enemiesProximityCoeff = 3
        // for (const agent of agentsManager.agents.elements){
        //     let distanceToEnemy = ManhattanDistance(x, y, agent[1].x, agent[1].y)
        //     enemiesProximity += Math.pow((((1/(distanceToEnemy+1) - 1)) * enemiesProximityCoeff), 2)
        // }


        return Math.pow(parcelsRewardInCell, 1.2) / Math.pow(distanceToAgent, 1) + minDistanceToBorder/1000
        return Math.pow(parcelsRewardInCell, 1.2) + minDistanceToBorder/1000 - Math.pow(distanceToAgent, 2)
        // la funzione per enemiesProximity va da pathLength +1 a infinito, ed è minima quando è 1 e massima quando è infinito
        // aggiungere decaying score for not visible cells, only for parcelsRewardInThisCell
    }

    deliveryCellHeuristic(x, y, map, agent, parcelsManager, agentsManager){
        let scoreParcelsCarriedByAgent = 0
        for (const parcel of parcelsManager.parcels.elements){
            if(parcel[1].carriedBy == agent.id){
                scoreParcelsCarriedByAgent += parcel[1].reward
            }
        }

        let distanceToAgent = 1
        if(scoreParcelsCarriedByAgent != 0){
            distanceToAgent = Math.max(PathLengthBFS(x, y, agent.x, agent.y, map), 0.1)
        }

        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
        return Math.pow(scoreParcelsCarriedByAgent, 0.8) - Math.pow(distanceToAgent, 1.2)
    }
    
    translatePddl(pddlPlan) {
        let plan = []
        let from, to;
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
        return plan
    }

    /**
     * 
     * @param {GameMap} map 
     * @param {AgentsManager} agentsManager 
     * @param {ParcelsManager} parcelsManager 
     * @param {You} agent 
     */
    async startPlanning(map, agentsManager, parcelsManager, agent){

        let target_x, target_y, bestscore, intention, tmpBeliefset, tmpPlan

        while(true){

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] === 0){ // wall cell
                        this.scoreMap[i][j] = 0
                    } else if(this.map[i][j] === 1){ // normal cell
                        this.scoreMap[i][j] = this.normalCellHeuristic(i, j, map, agent, parcelsManager, agentsManager)
                    } else if(this.map[i][j] === 2){ // delivery cell
                        this.scoreMap[i][j] = this.deliveryCellHeuristic(i, j, map, agent, parcelsManager, agentsManager)
                    }
                }
            }

            target_x = undefined
            target_y = undefined
            bestscore = -1
            intention = undefined
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.scoreMap[i][j] > bestscore && this.map[i][j] !== 0){
                        bestscore = this.scoreMap[i][j]
                        target_x = i
                        target_y = j
                        if(this.map[i][j] === 1){
                            intention = 'pickup'
                        } else if(this.map[i][j] === 2){
                            intention = 'putdown'
                        }
                    }
                }
            }


            
            //this.plan = BFS(agent.x, agent.y, target_x, target_y, map));
            //console.log("x:",agent.x,"->",target_x,"_ y:",agent.y,"->",target_y,"=",intention);
            tmpPlan = []

            if (this.control.ready) {
                if (target_x != agent.x || target_y != agent.y) {
                    tmpBeliefset = new Beliefset()
                    for (const entry of this.baseBeliefset.entries) {
                        tmpBeliefset.declare(entry[0])
                    }
                    for (const agent of agentsManager.agents.elements) {
                        if (agent[1].visible) {
                            tmpBeliefset.declare("cell c_" + agent[1].x + "_" + agent[1].y,false)
                        }
                    }
                    tmpBeliefset.declare("in c_" + agent.x + "_" + agent.y)
                    this.problem = new PddlProblem("BFS",
                        tmpBeliefset.objects.join(' '),
                        tmpBeliefset.toPddlString(),
                        "in c_" + target_x + "_" + target_y)
                    try {
                        tmpPlan = this.translatePddl(await onlineSolver(this.domain,this.problem.toPddlString()))
                    } catch (error) {}
                }
                tmpPlan.push(intention)
                this.plan = tmpPlan
            }
            /*
            Oggetti che ci sono:
                - target_x
                - target_y
                - intention che può essere 'pickup' o 'putdown'
                - agent che è istanza di You()
                - map (non this.map) che è istanza di GameMap()
                - parcelsManager che è istanza di ParcelsManager()
                - agentsManager che è istanza di AgentsManager()
            */

            await new Promise(res => setImmediate(res))
        }
    }

    getPlan(){
        return this.plan
    }

    print(agent){
        console.log('\n-----[SCOREMAP]-----')
        let padding = 4
        let highestValue = -100000000
        let lowestValue = 100000000
        for (let i = 0; i < this.n_rows; i++){
            for (let j = 0; j < this.n_cols; j++){
                if(this.scoreMap[i][j] > highestValue && this.map[i][j] !== 0){
                    highestValue = this.scoreMap[i][j]
                }
            }
        }
        for (let i = 0; i < this.n_rows; i++){
            for (let j = 0; j < this.n_cols; j++){
                if(this.scoreMap[i][j] < lowestValue && this.map[i][j] !== 0){
                    lowestValue = this.scoreMap[i][j]
                }
            }
        }
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                let value = addPadding(Math.round(100*(this.scoreMap[row][col]-lowestValue)/(highestValue-lowestValue)), padding)
                let shade = getColorHex(value)
                let color = chalk.hex(shade)
                if(agent.x == row && agent.y == col){
                    process.stdout.write(chalk.bgBlue(color(value)))
                } else if(this.map[row][col] == 0){
                    process.stdout.write(addPadding('', padding))
                } else {
                    process.stdout.write(color(value))
                }
            }
            process.stdout.write('\n\n')
        }
        process.stdout.write('-------------------\n')
    }
}

function getColorHex(value) {
    value = Math.max(0, Math.min(100, value));
    
    const red = Math.floor((100 - value) * 255 / 100);
    const green = Math.floor(value * 255 / 100);
    
    const redHex = red.toString(16).padStart(2, '0');
    const greenHex = green.toString(16).padStart(2, '0');
    const hexCode = '#' + redHex + greenHex + '00';
    
    return hexCode;
  }
  

function addPadding(item, padding){
    let out = '' + item
    while(out.length < padding){
        out += ' '
    }
    return out
}

export { Planner }