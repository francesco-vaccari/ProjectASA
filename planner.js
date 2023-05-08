import { Agents, GameMap, Parcels, You } from "./beliefs.js";
import { ManhattanDistance, BFS, PathLengthBFS, readFile } from "./util.js";
import { normalCellHeuristic, deliveryCellHeuristic } from "./heuristics.js";
import { onlineSolver, PddlProblem, Beliefset } from "@unitn-asa/pddl-client";
import chalk from "chalk"

class TargetCell{
    constructor(x, y, score, intention){
        this.x = x
        this.y = y
        this.score = score
        this.intention = intention
    }
}

class Planner{
    /**
     * 
     * @param {GameMap} map 
     * @param {Agents} agents 
     * @param {Parcels} parcels 
     * @param {You} agent 
     * @param {boolean} verbose 
     */
    constructor(map, agents, parcels, agent, control, verbose=false){
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

            this.startPlanning(map, agents, parcels, agent)
            
            if(this.verbose){
                setInterval(() => {
                    this.print(agent)
                }, 100)
            }
        }, 900)
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

    async startPlanning(map, agents, parcels, agent){

        let tmpBeliefset, tmpPlan, targets, found, count

        while(true){

            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] === 0){ // wall cell
                        this.scoreMap[i][j] = 0
                    } else if(this.map[i][j] === 1){ // normal cell
                        this.scoreMap[i][j] = normalCellHeuristic(i, j, map, agent, parcels, agents)
                    } else if(this.map[i][j] === 2){ // delivery cell
                        this.scoreMap[i][j] = deliveryCellHeuristic(i, j, map, agent, parcels, agents)
                    }
                }
            }

            /*target_x = undefined
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
            }*/

            targets = []
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if(this.map[i][j] !== 0) {
                        targets.push(new TargetCell(i, j, this.scoreMap[i][j], this.map[i][j] === 1 ? 'pickup' : 'putdown'))
                    }
                }
            }
            targets.sort((a, b) => {
                return b.score - a.score
            })


            // given the sorted targets list cycle through until find viable plan
            // elements in the list:
            //  - x
            //  - y
            //  - score
            //  - intention

            found = false
            count = 0
            while (!found && count < targets.length) {
                tmpPlan = []
                if (this.control.ready) {
                    if (targets[count].x != agent.x || targets[count].y != agent.y) {
                        tmpBeliefset = new Beliefset()
                        for (const entry of this.baseBeliefset.entries) {
                            tmpBeliefset.declare(entry[0])
                        }
                        for (const agent of agents.getMap()) {
                            if (agent[1].visible) {
                                tmpBeliefset.declare("cell c_" + agent[1].x + "_" + agent[1].y,false)
                            }
                        }
                        tmpBeliefset.declare("in c_" + agent.x + "_" + agent.y)
                        this.problem = new PddlProblem("BFS",
                            tmpBeliefset.objects.join(' '),
                            tmpBeliefset.toPddlString(),
                            "in c_" + targets[count].x + "_" + targets[count].y)
                        try {
                            tmpPlan = this.translatePddl(await onlineSolver(this.domain,this.problem.toPddlString()))
                            found = true
                        } catch (error) {}
                    }
                    if (found) {
                        tmpPlan = tmpPlan.concat([targets[count].intention])
                        this.plan = tmpPlan
                    }
                    count += 1
                }
                await new Promise(res => setImmediate(res))
            }

            await new Promise(res => setImmediate(res))
        }
    }

    getPlan(){
        return this.plan
    }

    print(agent){
        console.log('\n-----[SCOREMAP]-----')
        let padding = 4
        let highestValue = -Infinity
        let lowestValue = Infinity
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