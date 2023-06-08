import { ManhattanDistance } from './util.js'
import { Beliefset } from '@unitn-asa/pddl-client'

class Conf{
    constructor(client, verbose=false){
        this.agentsViewingDistance = undefined
        this.parcelsViewingDistance = undefined
        this.decayingTime = undefined
        this.verbose = verbose
        client.onConfig(data => {
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

class You{
    constructor(client, verbose=false){
        this.client = client
        this.verbose = verbose
        this.id = undefined
        this.client.onYou(data => {
            this.id = data.id
            this.name = data.name
            this.x = Math.round(data.x)
            this.y = Math.round(data.y)
            this.score = data.score
            if(this.verbose){
                this.print()
            }
        })
        this.makeSureYouIsSet()   
    }
    async makeSureYouIsSet(){
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

class Parcel{
    constructor( id, x, y, carriedBy, reward){
        this.id = id;
        this.x = x;
        this.y = y;
        this.carriedBy = carriedBy;
        this.reward = reward;
        this.visible = true
    }

    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward, this.visible);
    }
}

class Parcels{
    constructor(client, conf, agent, verbose=false){
        this.client = client
        this.conf = conf
        this.agent = agent
        this.verbose = verbose
        this.parcels = new Map()
        this.startDecay()
        this.client.onParcelsSensing(data => {
            this.setAllParcelsNotVisible()
            for(const parcel of data){
                this.add(new Parcel(parcel.id, Math.round(parcel.x), Math.round(parcel.y), parcel.carriedBy, parcel.reward))
            }
            this.deleteInconsistentParcels()
            if(this.verbose){
                this.print()
            }
        })
    }
    startDecay(){
        let once = false
        this.client.onParcelsSensing(() => {
            if(!once){
                if(this.conf.decayingTime != undefined){
                    once = true
                    if(this.conf.decayingTime != 0){
                        setInterval(() => {
                            for(const parcel of this.parcels){
                                parcel[1].reward -= 1
                            }
                        }, this.conf.decayingTime)
                    }
                }
            }
            for(const parcel of this.parcels){
                if(parcel[1].reward < 1){
                    this.parcels.delete(parcel[0])
                }
            }
        })
    }
    deleteInconsistentParcels(){
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
    add(parcel){
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
        this.type = type //0 wall, 1 normal, 2 delivery, 3 spawn
        this.lastSeen = 0
    }
}

class GameMap{
    constructor(client, conf, agent, verbose=false){
        this.client = client
        this.conf = conf
        this.agent = agent
        this.verbose = verbose
        this.n_rows = undefined
        this.n_cols = undefined
        this.matrix = []
        this.mapBeliefset = new Beliefset()
        this.client.onMap((width, height, cells) => {
            this.n_rows = width
            this.n_cols = height
            for (let i = 0; i < this.n_rows; i++){
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
                this.matrix[cell.x][cell.y].type = type
            }
            this.initializeOnlineBeliefset()
            if(this.verbose){
                this.print()
            }
            this.startTrackingSeenCells()
        })
    }
    startTrackingSeenCells(){
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
    initializeOnlineBeliefset() {

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

class Agent{
    constructor(id, name, x, y, score){
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
        this.visible = true
    }
    print(){
        console.log('[AGENT]\t', this.id, this.name, this.x, this.y, this.score, this.visible)
    }
}

class Agents{
    constructor(client, verbose=false){
        this.client = client
        this.verbose = verbose
        this.agents = new Map()
        this.forgetAgentsAfterNSeconds(3)
        this.client.onAgentsSensing(data => {
            this.setAllAgentsNotVisible()
            for (const agent of data){
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
    forgetAgentsAfterNSeconds(n){
        setInterval(() => {
            for (const agent of this.agents){
                if(!agent[1].visible){
                    this.agents.delete(agent[0])
                }
            }
        }, n*1000)
    }
    add(agent){
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