import { Beliefset } from '@unitn-asa/pddl-client'
import { ManhattanDistance } from './util.js'

class Conf{ // information about the environment, like the viewing distance of the agents
    constructor(client, verbose=false){
        this.agentsViewingDistance = undefined
        this.parcelsViewingDistance = undefined
        this.decayingTime = undefined
        this.verbose = verbose
        client.onConfig(data => { // when the configuration is received
            this.agentsViewingDistance = data.AGENTS_OBSERVATION_DISTANCE // set the viewing distance of the agents
            this.parcelsViewingDistance = data.PARCELS_OBSERVATION_DISTANCE // set the viewing distance of the parcels
            if(data.PARCEL_DECADING_INTERVAL != 'infinite'){
                this.decayingTime = parseInt(data.PARCEL_DECADING_INTERVAL.slice(0, -1)) * 1000 // set the decaying time of the parcels
            } else {
                this.decayingTime = 0
            }
            if(this.verbose){
                console.log('Conf initialized', this.agentsViewingDistance, this.parcelsViewingDistance, this.decayingTime)
            }
        })
    }
}

class You{ // belief set of the agent itself
    constructor(client, comm, verbose=false){
        this.client = client
        this.comm = comm
        this.verbose = verbose
        this.id = undefined
        this.client.onYou(data => { // every time the agent moves the information is updated
            this.id = data.id
            this.name = data.name
            this.x = Math.round(data.x) // rounding the coordinates from 0.6 or 0.4 to the correct next value to handle movements
            this.y = Math.round(data.y)
            this.score = data.score
            this.comm.say(this.createJSON()) // tell to the other the information about this agent
            if(this.verbose){
                this.print()
            }
        })
        // sometimes the first onYou that should be received on connection is not catched in time
        this.makeSureYouIsSet() // this is a workaround to make sure that the agent is initialized
        
    }
    createJSON(){
        return JSON.stringify({
            belief: 'YOU',
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            score: this.score
        })
    }
    async makeSureYouIsSet(){ // move randomly until the information is initialized
        let inter = setInterval(() => {
            this.client.move('up')
            this.client.move('down')
            this.client.move('left')
            this.client.move('right')
            if (this.id !== undefined){
                clearInterval(inter)
            }
        }, 500)
    }
    print(){
        console.log('[YOU]\t', this.id, this.name, this.x, this.y, this.score)
    }
}

class Parcel{ // representation of a parcel
    constructor( id, x, y, carriedBy, reward){
        this.id = id
        this.x = x
        this.y = y
        this.carriedBy = carriedBy
        this.reward = reward
        this.visible = true // if the parcel is visible or not
    }

    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward, this.visible);
    }
}

class ThisAgentParcels{ // this is the old belief set for parcels in the single-agent case, now is part of the joint complete parcels belief set
    constructor(client, parcels, conf, agent, comm, verbose=false){
        this.client = client
        this.parcels = parcels
        this.conf = conf
        this.agent = agent
        this.comm = comm
        this.verbose = verbose
        this.map = new Map() // map of parcels
        this.startDecay() // tracks decay for parcels stored
        this.client.onParcelsSensing(data => { // when an update of parcel is received
            this.setAllParcelsNotVisible() // set all parcels not visible
            for(const parcel of data){ // adds new parcels and updates the old ones
                this.add(new Parcel(parcel.id, Math.round(parcel.x), Math.round(parcel.y), parcel.carriedBy, parcel.reward))
            }
            // the next function handles two problems:
            // 1) a parcel which is not visible is moved by another agent
            // 2) after the agent delivers some parcels, they are set to not visible, but they are still in the parcels list
            this.deleteInconsistentParcels() // corrects the problems above
            this.comm.say(this.createJSON()) // when this list of parcels is updated, tell the updated list to the other agent
            if(this.verbose){
                this.print()
            }
            // this.parcels is the complete joint belief set of parcels which uses the list of parcels of this agent 
            // and the list of parcels of the other agent
            this.parcels.setMapOfThisAgent(this.map)
        })
    }
    createJSON(){
        return JSON.stringify({belief: 'PARCELS', map: Array.from(this.map)})
        
    }
    startDecay(){ // updates the reward of parcels according to the decaying time
        let once = false
        this.client.onParcelsSensing(() => { // starts decaying on sync with the parcels update (and so on sync with the server)
            if(!once){
                if(this.conf.decayingTime != undefined){ // if the decay time is set
                    once = true
                    if(this.conf.decayingTime != 0){ // if the decay time is not infinite
                        setInterval(() => {
                            for(const parcel of this.map){
                                parcel[1].reward -= 1
                            }
                        }, this.conf.decayingTime)
                    }
                }
            }
            for(const parcel of this.map){ // delete parcels with reward < 1
                if(parcel[1].reward < 1){
                    this.map.delete(parcel[0])
                }
            }
        })
    }
    deleteInconsistentParcels(){ // when a parcel is not visible, but is in the viewing distance, it is removed from the parcels list
        if(this.conf.parcelsViewingDistance != undefined){
            if(this.agent.x != undefined && this.agent.y != undefined){
                for(const parcel of this.map){
                    if(!parcel[1].visible && ManhattanDistance(this.agent.x, this.agent.y, parcel[1].x, parcel[1].y) < this.conf.parcelsViewingDistance){
                        this.map.delete(parcel[0])
                        this.comm.say(JSON.stringify({belief: 'DELETEPARCEL', parcel: parcel[1]}))
                    }
                }
            }
        }
    }
    setAllParcelsNotVisible(){
        for (const parcel of this.map){
            parcel[1].visible = false
        }
    }
    add(parcel){ // adds new parcels and updates values of the existing ones
        if(this.map.has(parcel.id)){
            this.map.get(parcel.id).x = parcel.x
            this.map.get(parcel.id).y = parcel.y
            this.map.get(parcel.id).carriedBy = parcel.carriedBy
            this.map.get(parcel.id).reward = parcel.reward
            this.map.get(parcel.id).visible = true
        } else {
            this.map.set(parcel.id, parcel)
        }
    }
    remove(parcel){
        this.map.delete(parcel.id)
    }
    print(){
        console.log('\n///////[PARCEL LIST]///////')
        for (const parcel of this.map){
            parcel[1].print();
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.map
    }
}

class Cell{ // representation of a cell in the map
    constructor(x, y, type){
        this.x = x
        this.y = y
        this.type = type // describes the type of the cell: 0 wall, 1 normal, 2 delivery, 3 spawn
        this.lastSeen = 0 // attributed used for the idle/searching movement, lower value means that the cell was seen more recently
    }
}

class GameMap{
    constructor(client, comm, conf, agent, verbose=false){
        this.client = client
        this.comm = comm
        this.conf = conf
        this.agent = agent
        this.verbose = verbose
        this.n_rows = undefined
        this.n_cols = undefined
        this.matrix = [] // the map is seen as a matrix of cells
        this.mapBeliefset = new Beliefset() // the map is seen as a PDDL beliefset (objects + init). It is encoded like an undirected graph
        this.client.onMap((width, height, cells) => { // received after connection to the server only once
            this.n_rows = width
            this.n_cols = height
            for (let i = 0; i < this.n_rows; i++){ // initialization of the matrix
                this.matrix.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.matrix[i].push(new Cell(i, j, 0))
                }
            }
            for(const cell of cells){
                let type = 0
                if(cell.delivery){
                    type = 2
                } else if(cell.parcelSpawner){
                    type = 3
                } else {
                    type = 1
                }
                this.matrix[cell.x][cell.y].type = type // set the type of each cell in the matrix
            }
            this.initializeOnlineBeliefset(cells) // initialize this.mapBeliefset
            if(this.verbose){
                this.print()
                this.printLastSeen()
            }
            this.startTrackingSeenCells() // starts updating the lastSeen attribute of each cell
        })
    }
    startTrackingSeenCells(){ // updates the lastSeen attribute of each cell using an interval
        setInterval(() => {
            if(this.agent.x !== undefined && this.agent.y !== undefined){
                if(this.conf.parcelsViewingDistance !== undefined){
                    for (let i = 0; i < this.n_rows; i++){
                        for (let j = 0; j < this.n_cols; j++){
                            if(this.matrix[i][j].type === 3){
                                if(ManhattanDistance(this.agent.x, this.agent.y, i, j) < this.conf.parcelsViewingDistance){
                                    this.comm.say(this.createJSON(i, j)) // signals to the other agent to reset the attribute lastSeen of cell i, j
                                    this.matrix[i][j].lastSeen = 0
                                } else {
                                    this.matrix[i][j].lastSeen += 1
                                }
                            }
                        }
                    }
                }
            }
        }, 300)
    }
    initializeOnlineBeliefset() { // take this.matrix and encode it into an undirected graph in the mapBeliefset

        let tmpCellArray, tmpCell

        this.mapBeliefset = new Beliefset()
        for (let i = 0; i < this.n_rows; i++) {
            for (let j = 0; j < this.n_cols; j++) {
                tmpCell = this.getMatrix()[i][j]
                if (tmpCell.type != 0) {
                    this.mapBeliefset.declare("cell c_" + tmpCell.x + "_" + tmpCell.y) //pddl cell initialization
                }
            }
        }

        for (const cell of this.mapBeliefset.objects) { //pddl cell edges initialization
            tmpCellArray = cell.split("_")
            for (let i = -1; i < 2; i+=2) {
                tmpCell = this.getMatrix()[Number.parseInt(tmpCellArray[1]) + i]
                tmpCell = tmpCell != undefined ? tmpCell[tmpCellArray[2]] : undefined
                if (tmpCell != undefined && tmpCell.type != 0) {
                    this.mapBeliefset.declare("near " + cell + " c_" + (Number.parseInt(tmpCellArray[1]) + i) + "_" + tmpCellArray[2])
                }
                tmpCell =  this.getMatrix()[tmpCellArray[1]]
                tmpCell = tmpCell != undefined ? tmpCell[Number.parseInt(tmpCellArray[2]) + i] : undefined
                if (tmpCell != undefined && tmpCell.type != 0) {
                    this.mapBeliefset.declare("near " + cell + " c_" + (tmpCellArray[1]) + "_" + (Number.parseInt(tmpCellArray[2]) + i))
                }
            }
        }
    }
    createJSON(x, y){
        return JSON.stringify({belief: 'MAP', x: x, y: y})
    }
    print(){
        console.log('\n-------[MAP]-------')
        let out = ''
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                if(this.matrix[row][col].type === 0){
                    out += '  '
                } else {
                    out += this.matrix[row][col].type + ' '
                }
            }
            out += '\n'
        }
        console.log(out)
        console.log('-------------------\n')
    }
    printLastSeen(){
        setInterval(() => {
            console.log('\n-------[LAST SEEN]-------')
            let out = ''
            for (let col = this.n_cols-1; col >= 0; col--){
                for (let row = 0; row < this.n_rows; row++){
                    if(this.matrix[row][col].type === 0){
                        out += '  '
                    } else {
                        out += this.matrix[row][col].lastSeen + ' '
                    }
                }
                out += '\n'
            }
            console.log(out)
            console.log('-------------------\n')
        }, 100)
    }
    getMatrix(){
        return this.matrix
    }
    getNRows(){
        return this.n_rows
    }
    getNCols(){
        return this.n_cols
    }
}

class Agent{ // class that represents an agent
    constructor(id, name, x, y, score, visible=true){
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
        this.visible = visible // if the agent is visible or not
    }
    print(){
        console.log('[AGENT]\t', this.id, this.name, this.x, this.y, this.score, this.visible)
    }
}

class ThisAgentAgents{// this is the old belief set of agents, now it is used as a part of the complete joint belief set of agents
    constructor(client, agents, comm, verbose=false){
        this.client = client
        this.agents = agents
        this.comm = comm
        this.verbose = verbose
        this.map = new Map() // map of agents
        this.forgetAgentsAfterNSeconds(3) // after 3 seconds, if an agent is not visible, it is removed from the agents list
        this.client.onAgentsSensing(data => { // when the agent receives an update of agents information
            this.setAllAgentsNotVisible() // sets all agents as not visible
            for (const agent of data){ // for each agent in the update adds new agents or updates the values of the existing ones
                if(agent.name !== 'god'){
                    this.add(new Agent(agent.id, agent.name, Math.round(agent.x), Math.round(agent.y), agent.score))
                }
            }
            this.comm.say(this.createJSON()) // commmunicate to the other agent the updated belief set
            if (this.verbose){
                this.print()
            }
            // this.agents is the complete joint belief set of agents
            this.agents.setMapOfThisAgent(this.map)
        })
    }
    createJSON(){
        return JSON.stringify({belief: 'AGENTS', map: Array.from(this.map)})
    }
    setAllAgentsNotVisible(){
        for (const agent of this.map){
            agent[1].visible = false
        }
    }
    forgetAgentsAfterNSeconds(n){ // after a number of seconds all agents not visible are removed
        setInterval(() => {
            for (const agent of this.map){
                if(!agent[1].visible){
                    this.map.delete(agent[0])
                }
            }
        }, n*1000)
    }
    add(agent){ // adds a new agent or updates the values of an existing one
        if(this.map.has(agent.id)){
            this.map.get(agent.id).x = agent.x
            this.map.get(agent.id).y = agent.y
            this.map.get(agent.id).score = agent.score
            this.map.get(agent.id).visible = true
        } else {
            this.map.set(agent.id, agent)
        }
    }
    print(){
        console.log('\n///////[AGENT LIST]///////')
        for (const agent of this.map){
            agent[1].print()
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.map
    }
}

class Target{ // class that represents a target/intention, the same used in the planner
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention // intention can be 'error', 'pickup', 'putdown', 'exchange', 'block', 'idle
        this.score = score // score gin by the utilities functions in the planner
    }
}

class OtherAgent{ // this is the belief set that contains the information about the other agent
    constructor(verbose=false){ // all the values are updated through messages received from the other agent
        this.verbose = verbose
        this.id = undefined
        this.name = undefined
        this.x = undefined // coordinates
        this.y = undefined
        this.score = undefined // current score
        this.target = new Target(undefined, undefined) // current target/intention of the other agent
        this.scoreParcelsCarried = 0 // total score of parcels currently being carried by the other agent
        if(this.verbose){
            setInterval(() => {
                this.print()
            }, 200)
        }
    }
    set(json){ // function used in the communication handler
        this.id = json.id
        this.name = json.name
        this.x = json.x
        this.y = json.y
        this.score = json.score
    }
    print(){
        console.log('[OTHERAGENT]\t', this.id, this.name, this.x, this.y, this.score, '\tCarried: ', this.scoreParcelsCarried, '\tTarget: ', this.target.x, this.target.y, this.target.intention)
    }
}

class OtherAgentAgents{
    // this belief set is a copy of the belief set of the other agent
    // updated when a specific message is received
    // used in the complete joint belief set
    constructor(agents, verbose=false){
        this.verbose = verbose
        this.agents = agents
        this.map = new Map()
    }
    clearAndAddAll(agents){ // method used in the communication handler when a specific message is received, updates the belief set
        this.map.clear()
        for(const agent of agents){
            this.map.set(agent[0], agent[1])
        }
        if(this.verbose){
            this.print()
        }
        this.agents.setMapOfOtherAgent(this.map) // this.agents is the complete joint belief set of agents
    }
    print(){
        console.log('\n///////[OTHER AGENT LIST]///////')
        for (const agent of this.map){
            console.log('[OTHERAGENT]\t', agent[0], agent[1].name, agent[1].x, agent[1].y, agent[1].score, agent[1].visible)
        }
        console.log('////////////////////////////\n')
    }
}

class OtherAgentParcels{
    // this belief set is a copy of the belief set of the other agent
    // updated when a specific message is received
    // used in the complete joint belief set
    constructor(parcels, verbose=false){
        this.verbose = verbose
        this.parcels = parcels
        this.map = new Map()
    }
    clearAndAddAll(parcels){  // method used in the communication handler when a specific message is received, updates the belief set
        this.map.clear()
        for(const parcel of parcels){
            this.map.set(parcel[0], parcel[1])
        }
        if(this.verbose){
            this.print()
        }
        this.parcels.setMapOfOtherAgent(this.map) // this.parcels is the complete joint belief set of agents
    }
    print(){
        console.log('\n///////[OTHER AGENT PARCEL LIST]///////')
        for (const parcel of this.map){
            console.log('[OTHERPARCEL]\t', parcel[0], parcel[1].x, parcel[1].y, parcel[1].carriedBy, parcel[1].reward, parcel[1].visible)
        }
        console.log('////////////////////////////\n')
    }
}

class Parcels{ // complete joint belief set of parcels
    constructor(conf, thisAgent, otherAgent, verbose=false){
        this.verbose = verbose
        this.thisAgent = thisAgent
        this.otherAgent = otherAgent
        this.conf = conf
        this.parcels = new Map() // belief set used for planning and decision making, contains the full information of both agents
        this.mapOfThisAgent = new Map() // partial belief set, contains only the information known by this agent
        this.mapOfOtherAgent = new Map() // partial belief set, contains only the information known by the other agent
    }
    setMapOfThisAgent(map){
        this.mapOfThisAgent = map
        this.joinMaps()
    }
    setMapOfOtherAgent(map){
        this.mapOfOtherAgent = map
        this.joinMaps()
    }
    joinMaps(){ // when one of the two partial belief sets is updated this function is called to update the full belief set
        this.parcels.clear() // empty the list of parcels
        for(const parcel of this.mapOfThisAgent){ // then first insert the parcels seen by this agent
            this.parcels.set(parcel[0], parcel[1])
        }
        for(const parcel of this.mapOfOtherAgent){ // then insert the parcels seen by the other agent making sure to create no inconsistencies
            if(!this.parcels.has(parcel[0])){
                this.parcels.set(parcel[0], parcel[1])
            } else {
                if(!this.parcels.get(parcel[0].visible) && parcel[1].visible){
                    this.parcels.set(parcel[0], parcel[1])
                }
            }
        }
        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('\n///////[PARCEL LIST UNIFIED]///////')
        for (const parcel of this.parcels){
            console.log('[PARCEL]\t', parcel[0], parcel[1].x, parcel[1].y, parcel[1].carriedBy, parcel[1].reward)
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.parcels
    }
}

class Agents{ // complete joint belief set of agents
    constructor(conf, agent, otherAgent, verbose=false){
        this.verbose = verbose
        this.agent = agent
        this.otherAgent = otherAgent
        this.conf = conf
        this.agents = new Map() // belief set used for planning and decision making, contains the full information of both agents
        this.mapOfThisAgent = new Map() // partial belief set, contains only the information known by this agent
        this.mapOfOtherAgent = new Map() // partial belief set, contains only the information known by the other agent
    }
    setMapOfThisAgent(map){
        this.mapOfThisAgent = map
        this.joinMaps()
    }
    setMapOfOtherAgent(map){
        this.mapOfOtherAgent = map
        this.joinMaps()
    }
    joinMaps(){ // when one of the two partial belief sets is updated this function is called to update the full belief set
        this.agents.clear() // empty the list of agents
        if(this.agent.id !== undefined){ // insert the agent itself in the belief set (make sure it is not undefined)
            this.agents.set(this.agent.id, new Agent(this.agent.id, this.agent.name, this.agent.x, this.agent.y, this.agent.score, true))
        }
        if(this.otherAgent.id !== undefined){ // insert the other agent in the belief set (make sure it is not undefined)
            this.agents.set(this.otherAgent.id, new Agent(this.otherAgent.id, this.otherAgent.name, this.otherAgent.x, this.otherAgent.y, this.otherAgent.score, true))
        }

        for(const agent of this.mapOfThisAgent){ // first insert the agents seen by this agent
            if(agent[0] !== this.agent.id && agent[0] !== this.otherAgent.id){
                this.agents.set(agent[0], agent[1])
            }
        }
        for(const agent of this.mapOfOtherAgent){ // then insert the agents seen by the other agent making sure to create no inconsistencies
            if(agent[0] !== this.agent.id && agent[0] !== this.otherAgent.id){
                if(!this.agents.has(agent[0])){
                    this.agents.set(agent[0], agent[1])
                } else {
                    if(!this.agents.get(agent[0]).visible && agent[1].visible){
                        this.agents.set(agent[0], agent[1])
                    }
                }
            }
        }

        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('\n///////[AGENT LIST UNIFIED]///////')
        for (const agent of this.agents){
            console.log('[AGENT]\t', agent[0], agent[1].name, agent[1].x, agent[1].y, agent[1].score, agent[1].visible)
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.agents
    }
}

class Enemies{ // belief set specifically implemented for the blocking strategy
    constructor(client, thisAgent, otherAgent, agents, verbose=false){
        this.client = client
        this.verbose = verbose
        this.thisAgent = thisAgent
        this.otherAgent = otherAgent
        this.agents = agents
        this.initialized = false // says whether both enemies were found and initialized

        this.enemyOne = new Agent(undefined, undefined, undefined, undefined, undefined, false) // enemy agents 1 and 2
        this.enemyTwo = new Agent(undefined, undefined, undefined, undefined, undefined, false)

        this.initializeEnemies() // search in the agents belief set for agents that are not this agent or the other agent
        this.updateEnemies() // keep track of enemies updating their position, score and visibility
        
        if(this.verbose){
            setInterval(() => {
                this.print()
            }, 200)
        }
    }
    async initializeEnemies(){ // search in the agents belief set for agents that are not this agent or the other agent
        while(!this.initialized){ // while both enemies are not found
            if(this.thisAgent.id !== undefined && this.otherAgent.id !== undefined){ // if both (our) agents are initialized
                for(const agent of this.agents.getMap()){ // iterate through the agents belief set
                    if(agent[0] !== this.thisAgent.id && agent[0] !== this.otherAgent.id){ // if the agent in the belief set is not ours
                        if(this.enemyOne.id === undefined){ // if the first enemy is not initialized
                            this.enemyOne = agent[1] // initialize it
                        } else if(this.enemyTwo.id === undefined && agent[0] !== this.enemyOne.id){ // if the second enemy is not initialized and the agent is not the first enemy
                            this.enemyTwo = agent[1] // initialize the second enemy
                            this.initialized = true // both enemies are initialized
                        }
                    }
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }
    async updateEnemies(){ // keep track of enemies updating their position, score and visibility
        while(true){
            if(this.initialized){ // if both enemies are initialized
                for(const agent of this.agents.getMap()){ // iterate through the agents belief set
                    if(agent[0] === this.enemyOne.id){ // if the agent is the first enemy
                        this.enemyOne = agent[1] // update the first enemy
                    }
                    if(agent[0] === this.enemyTwo.id){ // if the agent is the second enemy
                        this.enemyTwo = agent[1] // update the second enemy
                    }
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }
    print(){
        console.log('\n///////[ENEMY LIST]///////')
        console.log('[ENEMY]\t', this.enemyOne.id, this.enemyOne.name, this.enemyOne.x, this.enemyOne.y, this.enemyOne.score, this.enemyOne.visible)
        console.log('[ENEMY]\t', this.enemyTwo.id, this.enemyTwo.name, this.enemyTwo.x, this.enemyTwo.y, this.enemyTwo.score, this.enemyTwo.visible)
        console.log('////////////////////////////\n')
    }
}

export { Conf, You, ThisAgentParcels, OtherAgentParcels, GameMap, OtherAgent, ThisAgentAgents, OtherAgentAgents, Parcels, Agents, Enemies }