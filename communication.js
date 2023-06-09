class Communication{
    constructor(client, who, verbose=false){
        this.client = client
        this.verbose = verbose
        this.otherAgentId = undefined
        this.buffer = []
        this.who = who
        this.INIT = 'init'
        this.SECRET = 'secret'
        this.OKAY = 'okay'
        this.counter = 0
        if(this.who === 'one'){
            this.initializeCommunicationOne()
        } else if(this.who === 'two'){
            this.initializeCommunicationTwo()
        }
    }
    initializeCommunicationOne(){
        let interval = setInterval(() => {
            this.client.shout(this.INIT)
        }, 200)
    
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === undefined){
                if(msg === this.SECRET){
                    clearInterval(interval)
                    this.client.say(fromId, this.OKAY)
                    this.otherAgentId = fromId
                    setTimeout(() => {
                        this.startReceiving()
                    }, 100)
                    if(this.verbose){
                        console.log('['+this.who+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    initializeCommunicationTwo(){
        let onceInit = false
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === undefined){
                if(msg === this.INIT){
                    if(!onceInit){
                        this.client.say(fromId, this.SECRET)
                    }
                }
                if(msg === this.OKAY){
                    onceInit = true
                    this.otherAgentId = fromId
                    setTimeout(() => {
                        this.startReceiving()
                    }, 100)
                    if(this.verbose){
                        console.log('['+this.who+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    startReceiving(){
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === fromId){
                this.buffer.push(msg)
            }
        })
    }
    say(msg){
        if(this.otherAgentId !== undefined){
            this.client.say(this.otherAgentId, msg)
            return true
        } else {
            return false
        }
    }
    getOtherAgentId(){
        return this.otherAgentId
    }
}

class CommunicationHandler{
    constructor(comm, agent, otherAgent, map, thisAgentParcels, otherAgentParcels, thisAgentAgents, otherAgentAgents, planner, verbose=false){
        this.comm = comm
        this.agent = agent
        this.otherAgent = otherAgent
        this.map = map
        this.thisAgentParcels = thisAgentParcels
        this.otherAgentParcels = otherAgentParcels
        this.thisAgentAgents = thisAgentAgents
        this.otherAgentAgents = otherAgentAgents
        this.planner = planner
        this.verbose = verbose
        this.handleMessages()
    }
    async handleMessages(){
        while(true){
            if(this.comm.buffer.length > 0){
                let msg = this.comm.buffer.shift()
                let json = {}
                try{
                    json = JSON.parse(msg)
                } catch(err) {
                    json.belief = 'error'
                }
                if(json.belief === 'YOU'){
                    this.otherAgent.set(json)
                } else if (json.belief === 'PARCELS'){
                    this.otherAgentParcels.clearAndAddAll(json.map)
                } else if (json.belief === 'DELETEPARCEL'){
                    this.thisAgentParcels.remove(json.parcel)
                } else if (json.belief === 'AGENTS'){
                    this.otherAgentAgents.clearAndAddAll(json.map)
                } else if(json.belief === 'MAP'){
                    this.map.getMatrix()[json.x][json.y].lastSeen = 0
                } else if(json.belief === 'TARGETUPDATE'){
                    this.otherAgent.target = json.target
                } else if(json.belief === 'CARRYUPDATE'){
                    this.otherAgent.scoreParcelsCarried = json.score
                } else if(json.belief === 'STARTEXCHANGE'){
                    this.planner.exchangeSlave = true
                    this.planner.plan = []
                    this.planner.target.x =  this.agent.x
                    this.planner.target.y =  this.agent.y
                    this.planner.target.intention = 'exchange'
                } else if(json.belief === 'EXCHANGETARGET'){
                    this.planner.target = json.target
                } else if(json.belief === 'ENDEXCHANGETARGET'){
                    this.planner.endExchangeTarget = json.target
                } else if(json.belief === 'ENDEXCHANGE'){
                    this.planner.exchangeMaster = false
                    this.planner.exchangeSlave = false
                    this.planner.plan = []
                    this.planner.endExchangeTarget.x = -1
                    this.planner.endExchangeTarget.y = -1
                    this.planner.endExchangeTarget.intention = 'error'
                } else if(json.belief === 'BLOCKSTRATEGY'){
                    this.planner.blockStrategy = true
                    this.planner.target = json.target
                } else if(json.belief === 'ENDBLOCKSTRATEGY'){
                    this.planner.blockStrategy = false
                    this.planner.target.x = -1
                    this.planner.target.y = -1
                    this.planner.target.intention = 'error'
                }

                if(this.verbose){
                    console.log('[HANDLE]\tMessages in buffer ', this.comm.buffer.length)
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }
}

export { Communication, CommunicationHandler }