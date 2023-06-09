import { ManhattanDistance } from './util.js'
import { Beliefset } from '@unitn-asa/pddl-client'

class Conf{ // information about the environment, like the viewing distance of the agents
    constructor(client, verbose=false){
        this.agentsViewingDistance = undefined
        this.parcelsViewingDistance = undefined
        this.decayingTime = undefined
        this.verbose = verbose
        client.onConfig(data => { // Once connected, the agent gets the configuration of the game
            this.agentsViewingDistance = data.AGENTS_OBSERVATION_DISTANCE
            this.parcelsViewingDistance = data.PARCELS_OBSERVATION_DISTANCE
            if(data.PARCEL_DECADING_INTERVAL != 'infinite'){
                this.decayingTime = parseInt(data.PARCEL_DECADING_INTERVAL.slice(0, -1)) * 1000
            } else {
                this.decayingTime = 0
            }
            if(this.verbose){
                console.log('Conf initialized', this.agentsViewingDistance, this.parcelsViewingDistance, this.decayingTime)
            }
        })
    }
}

class You{ // belief set about the agent itself
    constructor(client, verbose=false){
        this.client = client
        this.verbose = verbose
        this.id = undefined
        this.client.onYou(data => { // every time the agent moves the information is updated
            this.id = data.id
            this.name = data.name
            this.x = Math.round(data.x) // rounding the coordinates from 0.6 or 0.4 to the correct next value to handle movements
            this.y = Math.round(data.y)
            this.score = data.score
            if(this.verbose){
                this.print()
            }
        })
        // sometimes the first onYou that should be received on connection is not catched in time
        this.makeSureYouIsSet() // this is a workaround to make sure that the agent is initialized
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

class Parcel{ // class to represent a parcel
    constructor( id, x, y, carriedBy, reward){
        this.id = id;
        this.x = x;
        this.y = y;
        this.carriedBy = carriedBy;
        this.reward = reward;
        this.visible = true // if the parcel is in the viewing distance of the agent this is set to true
    }

    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward, this.visible);
    }
}

class Parcels{ // belief set of the parcels
    constructor(client, conf, agent, verbose=false){
        this.client = client
        this.conf = conf
        this.agent = agent
        this.verbose = verbose
        this.parcels = new Map() // this map contains the information about the parcels
        this.startDecay() // this function starts updating the rewards of the parcels in the parcels list
        this.client.onParcelsSensing(data => { // when an update of parcels is received
            this.setAllParcelsNotVisible() // all the parcels are set to not visible
            for(const parcel of data){ // adds new parcels and updates values of the existing ones
                this.add(new Parcel(parcel.id, Math.round(parcel.x), Math.round(parcel.y), parcel.carriedBy, parcel.reward))
            }
            // the next function handles two problems:
            // 1) a parcel which is not visible is moved by another agent
            // 2) after the agent delivers some parcels, they are set to not visible, but they are still in the parcels list
            this.deleteInconsistentParcels() // corrects the problems above
            if(this.verbose){
                this.print()
            }
        })
    }
    startDecay(){
        let once = false
        this.client.onParcelsSensing(() => { // the decaying interval is set only once, in sync with a parcels update
            if(!once){
                if(this.conf.decayingTime != undefined){ // if the decaying time was initialized
                    once = true // the timer is set only once
                    if(this.conf.decayingTime != 0){ // if the decaying time is not infinite
                        setInterval(() => { // apply the decay to the parcels
                            for(const parcel of this.parcels){
                                parcel[1].reward -= 1
                            }
                        }, this.conf.decayingTime) // the interval is set to the decaying time
                    }
                }
            }
            for(const parcel of this.parcels){ // if the reward of a parcel is less than 1, it is removed from the parcels list
                if(parcel[1].reward < 1){
                    this.parcels.delete(parcel[0])
                }
            }
        })
    }
    deleteInconsistentParcels(){ // when a parcel is not visible, but is in the viewing distance, it is removed from the parcels list
        if(this.conf.parcelsViewingDistance != undefined){
            if(this.agent.x != undefined && this.agent.y != undefined){
                for(const parcel of this.parcels){
                    if(!parcel[1].visible && ManhattanDistance(this.agent.x, this.agent.y, parcel[1].x, parcel[1].y) < this.conf.parcelsViewingDistance){
                        this.parcels.delete(parcel[0])
                    }
                }
            }
        }
    }
    setAllParcelsNotVisible(){
        for (const parcel of this.parcels){
            parcel[1].visible = false
        }
    }
    add(parcel){ // adds new parcels and updates values of the existing ones
        if(this.parcels.has(parcel.id)){
            this.parcels.get(parcel.id).x = parcel.x
            this.parcels.get(parcel.id).y = parcel.y
            this.parcels.get(parcel.id).carriedBy = parcel.carriedBy
            this.parcels.get(parcel.id).reward = parcel.reward
            this.parcels.get(parcel.id).visible = true
        } else {
            this.parcels.set(parcel.id, parcel)
        }
    }
    print(){
        console.log('\n///////[PARCEL LIST]///////')
        for (const parcel of this.parcels){
            parcel[1].print();
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.parcels
    }
}

class Cell{
    constructor(x, y, type){
        this.x = x
        this.y = y
        this.type = type // describes the type of the cell: 0 wall, 1 normal, 2 delivery, 3 spawn
        this.lastSeen = 0 // attributed used for the idle/searching movement, lower value means that the cell was seen more recently
    }
}

class GameMap{ // contains information about the map
    constructor(client, conf, agent, verbose=false){
        this.client = client
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
            this.initializeOnlineBeliefset() // initialize this.mapBeliefset
            if(this.verbose){
                this.print()
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
                            if(ManhattanDistance(this.agent.x, this.agent.y, i, j) < this.conf.parcelsViewingDistance){
                                this.matrix[i][j].lastSeen = 0
                            } else {
                                this.matrix[i][j].lastSeen += 1
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
        }, 500)
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
    constructor(id, name, x, y, score){
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
        this.visible = true // if the agent is visible or not
    }
    print(){
        console.log('[AGENT]\t', this.id, this.name, this.x, this.y, this.score, this.visible)
    }
}

class Agents{
    constructor(client, verbose=false){
        this.client = client
        this.verbose = verbose
        this.agents = new Map() // map of agents
        this.forgetAgentsAfterNSeconds(3) // after 3 seconds, if an agent is not visible, it is removed from the agents list
        this.client.onAgentsSensing(data => { // when the agent receives an update of agents information
            this.setAllAgentsNotVisible() // sets all agents as not visible
            for (const agent of data){ // for each agent in the update adds new agents or updates the values of the existing ones
                if(agent.name !== 'god'){
                    this.add(new Agent(agent.id, agent.name, Math.round(agent.x), Math.round(agent.y), agent.score))
                }
            }
            if (this.verbose){
                this.print()
            }
        })
    }
    setAllAgentsNotVisible(){
        for (const agent of this.agents){
            agent[1].visible = false
        }
    }
    forgetAgentsAfterNSeconds(n){ // after a number of seconds all agents not visible are removed
        setInterval(() => {
            for (const agent of this.agents){
                if(!agent[1].visible){
                    this.agents.delete(agent[0])
                }
            }
        }, n*1000)
    }
    add(agent){ // adds a new agent or updates the values of an existing one
        if(this.agents.has(agent.id)){
            this.agents.get(agent.id).x = agent.x
            this.agents.get(agent.id).y = agent.y
            this.agents.get(agent.id).score = agent.score
            this.agents.get(agent.id).visible = true
        } else {
            this.agents.set(agent.id, agent)
        }
    }
    print(){
        console.log('\n///////[AGENT LIST]///////')
        for (const agent of this.agents){
            agent[1].print()
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.agents
    }
}

export { Conf, You, Parcels, GameMap, Agents }