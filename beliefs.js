import { ManhattanDistance } from './util.js'

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
    constructor(client, comm, verbose=false){
        this.client = client
        this.comm = comm
        this.verbose = verbose
        this.id = undefined
        this.client.onYou(data => {
            this.id = data.id
            this.name = data.name
            this.x = Math.round(data.x)
            this.y = Math.round(data.y)
            this.score = data.score
            this.comm.say(this.createJSON())
            if(this.verbose){
                this.print()
            }
        })
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
    print(){
        console.log('[YOU]\t', this.id, this.name, this.x, this.y, this.score)
    }
}

class Parcel{
    constructor( id, x, y, carriedBy, reward){
        this.id = id
        this.x = x
        this.y = y
        this.carriedBy = carriedBy
        this.reward = reward
        this.visible = true
    }

    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward, this.visible);
    }
}

class ThisAgentParcels{
    constructor(client, conf, agent, comm, verbose=false){
        this.client = client
        this.conf = conf
        this.agent = agent
        this.comm = comm
        this.verbose = verbose
        this.parcels = new Map()
        this.startDecay()
        this.client.onParcelsSensing(data => {
            this.setAllParcelsNotVisible()
            for(const parcel of data){
                this.add(new Parcel(parcel.id, Math.round(parcel.x), Math.round(parcel.y), parcel.carriedBy, parcel.reward))
            }
            this.deleteInconsistentParcels()
            this.comm.say(this.createJSON())
            if(this.verbose){
                this.print()
            }
        })
    }
    createJSON(){
        return JSON.stringify({belief: 'PARCELS', map: Array.from(this.parcels)})
        
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
    constructor(client, comm, conf, agent, verbose=false){
        this.client = client
        this.comm = comm
        this.conf = conf
        this.agent = agent
        this.verbose = verbose
        this.n_rows = undefined
        this.n_cols = undefined
        this.matrix = []
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
            if(this.verbose){
                this.print()
                this.printLastSeen()
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
                            if(this.matrix[i][j].type === 3){
                                if(ManhattanDistance(this.agent.x, this.agent.y, i, j) < this.conf.parcelsViewingDistance){
                                    this.comm.say(this.createJSON(i, j))
                                    this.matrix[i][j].lastSeen = 0
                                } else {
                                    this.matrix[i][j].lastSeen += 1
                                }
                            }
                        }
                    }
                }
            }
        }, 50)
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

class ThisAgentAgents{
    constructor(client, comm, verbose=false){
        this.client = client
        this.comm = comm
        this.verbose = verbose
        this.agents = new Map()
        this.forgetAgentsAfterNSeconds(3)
        this.client.onAgentsSensing(data => {
            this.setAllAgentsNotVisible()
            for (const agent of data){
                this.add(new Agent(agent.id, agent.name, Math.round(agent.x), Math.round(agent.y), agent.score))
            }
            this.comm.say(this.createJSON())
            if (this.verbose){
                this.print()
            }
        })
    }
    createJSON(){
        return JSON.stringify({belief: 'AGENTS', map: Array.from(this.agents)})
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

class OtherAgent{
    constructor(verbose=false){
        this.verbose = verbose
        this.id = undefined
        this.name = undefined
        this.x = undefined
        this.y = undefined
        this.score = undefined
    }
    set(json){
        this.id = json.id
        this.name = json.name
        this.x = json.x
        this.y = json.y
        this.score = json.score
        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('[OTHERAGENT]\t', this.id, this.name, this.x, this.y, this.score)
    }
}

class OtherAgentAgents{
    constructor(verbose=false){
        this.verbose = verbose
        this.agents = new Map()
    }
    clearAndAddAll(agents){
        this.agents.clear()
        for(const agent of agents){
            this.agents.set(agent[0], agent[1])
        }
        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('\n///////[OTHER AGENT LIST]///////')
        for (const agent of this.agents){
            console.log('[OTHERAGENT]\t', agent[0], agent[1].name, agent[1].x, agent[1].y, agent[1].score)
        }
        console.log('////////////////////////////\n')
    }
}

class OtherAgentParcels{
    constructor(verbose=false){
        this.verbose = verbose
        this.parcels = new Map()
    }
    clearAndAddAll(parcels){
        this.parcels.clear()
        for(const parcel of parcels){
            this.parcels.set(parcel[0], parcel[1])
        }
        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('\n///////[OTHER AGENT PARCEL LIST]///////')
        for (const parcel of this.parcels){
            console.log('[OTHERPARCEL]\t', parcel[0], parcel[1].x, parcel[1].y, parcel[1].carriedBy, parcel[1].reward)
        }
        console.log('////////////////////////////\n')
    }
}

export { Conf, You, ThisAgentParcels, OtherAgentParcels, GameMap, OtherAgent, ThisAgentAgents, OtherAgentAgents }