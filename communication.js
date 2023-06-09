class Communication{ // in this class the ids of the agents are exchanged in order to communicate
    constructor(client, who, verbose=false){
        this.client = client
        this.verbose = verbose
        this.otherAgentId = undefined // id of the other agent
        this.buffer = [] // buffer of messages received from the other agent
        this.who = who // defines which agent is the sender and which is the receiver of the first INIT message
        this.INIT = 'init' // message used to initialize the communication
        this.SECRET = 'secret' // message used to initialize the communication
        this.OKAY = 'okay' // message used to initialize the communication
        this.counter = 0
        if(this.who === 'one'){
            this.initializeCommunicationOne() // initialize communication sender
        } else if(this.who === 'two'){
            this.initializeCommunicationTwo() // initialize communication receiver
        }
    }
    initializeCommunicationOne(){ // protocol for initializing communication by sender
        let interval = setInterval(() => { // send INIT message every 200ms
            this.client.shout(this.INIT)
        }, 200)
    
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === undefined){
                if(msg === this.SECRET){ // when the SECRET message is received sends an OKAY
                    clearInterval(interval)
                    this.client.say(fromId, this.OKAY)
                    this.otherAgentId = fromId // and sets the otherAgentId
                    setTimeout(() => {
                        this.startReceiving() // then starts storing the message in the buffer for handling
                    }, 100)
                    if(this.verbose){
                        console.log('['+this.who+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    initializeCommunicationTwo(){ // protocol for initializing communication by receiver
        let onceInit = false
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === undefined){
                if(msg === this.INIT){ // when the INIT message is received sends a SECRET
                    if(!onceInit){
                        this.client.say(fromId, this.SECRET)
                    }
                }
                if(msg === this.OKAY){ // when the OKAY message is received set the otherAgentId
                    onceInit = true
                    this.otherAgentId = fromId
                    setTimeout(() => {
                        this.startReceiving() // and start storing the message in the buffer for handling
                    }, 100)
                    if(this.verbose){
                        console.log('['+this.who+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    startReceiving(){ // stores the messages in the buffer for handling
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === fromId){
                this.buffer.push(msg)
            }
        })
    }
    say(msg){ // function used in the beliefs sets and in the planner to communicate information to the other agent
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

class CommunicationHandler{ // in this class the messages received from the other agent are handled
    constructor(comm, agent, otherAgent, map, thisAgentParcels, otherAgentParcels, thisAgentAgents, otherAgentAgents, planner, verbose=false){
        this.comm = comm
        this.agent = agent
        this.otherAgent = otherAgent
        this.map = map
        this.thisAgentParcels = thisAgentParcels // belief set of parcels known by this agent
        this.otherAgentParcels = otherAgentParcels // belief set of parcels known by the other agent
        this.thisAgentAgents = thisAgentAgents // belief set of agents known by this agent
        this.otherAgentAgents = otherAgentAgents // belief set of agents known by the other agent
        this.planner = planner
        this.verbose = verbose
        this.handleMessages()
    }
    async handleMessages(){
        while(true){
            if(this.comm.buffer.length > 0){ // if there are messages in the buffer
                let msg = this.comm.buffer.shift() // get the first message
                let json = {}
                try{
                    json = JSON.parse(msg) // parse the message
                } catch(err) {
                    json.belief = 'error'
                }
                // the 'belief' field of the message defines the type of message
                // the type of message defines which belief sets or which information have to be updated
                if(json.belief === 'YOU'){ // information about the other agent (position, score)
                    this.otherAgent.set(json)
                } else if (json.belief === 'PARCELS'){ // information about the parcels known by the other agent
                    this.otherAgentParcels.clearAndAddAll(json.map)
                } else if (json.belief === 'DELETEPARCEL'){ // tells to delete a parcel from the belief set of this agent
                    this.thisAgentParcels.remove(json.parcel)
                } else if (json.belief === 'AGENTS'){ // information about the agents known by the other agent
                    this.otherAgentAgents.clearAndAddAll(json.map)
                } else if(json.belief === 'MAP'){ // information about the lastSeen attributes of the cells
                    this.map.getMatrix()[json.x][json.y].lastSeen = 0
                } else if(json.belief === 'TARGETUPDATE'){ // the other agents tells us that it has a new target
                    this.otherAgent.target = json.target
                } else if(json.belief === 'CARRYUPDATE'){ // the other agents tells us how much in parcels it is carrying
                    this.otherAgent.scoreParcelsCarried = json.score
                } else if(json.belief === 'STARTEXCHANGE'){ // message that request the start of the exchange intention
                    this.planner.exchangeSlave = true
                    this.planner.plan = []
                    this.planner.target.x =  this.agent.x
                    this.planner.target.y =  this.agent.y
                    this.planner.target.intention = 'exchange'
                } else if(json.belief === 'EXCHANGETARGET'){ // message that communicates the target of the exchange intention
                    this.planner.target = json.target
                } else if(json.belief === 'ENDEXCHANGETARGET'){ // message that communicates the LAST target of the exchange intention
                    this.planner.endExchangeTarget = json.target
                } else if(json.belief === 'ENDEXCHANGE'){ // message that signals the end of the exchange intention
                    this.planner.exchangeMaster = false
                    this.planner.exchangeSlave = false
                    this.planner.plan = []
                    this.planner.endExchangeTarget.x = -1
                    this.planner.endExchangeTarget.y = -1
                    this.planner.endExchangeTarget.intention = 'error'
                } else if(json.belief === 'BLOCKSTRATEGY'){ // message that signals the start of the block strategy
                    this.planner.blockStrategy = true
                    this.planner.target = json.target
                } else if(json.belief === 'ENDBLOCKSTRATEGY'){ // message that signals the end of the block strategy
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