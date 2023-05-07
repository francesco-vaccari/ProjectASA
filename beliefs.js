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
    constructor(client, verbose=false) {
        this.client = client
        this.verbose = verbose
        this.parcels = new Map()
        this.startStoringParcels()
    }

    startStoringParcels(){
        this.client.onParcelsSensing(data => {
            this.setAllParcelsNotVisible()
            for(const parcel of data){
                this.add(new Parcel(parcel.id, parcel.x, parcel.y, parcel.carriedBy, parcel.reward))
            }

            if (this.verbose){
                this.print()
            }
        });
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

    setAllParcelsNotVisible(){
        for (const parcel of this.parcels){
            parcel[1].visible = false
        }
    }

    clearPutdownParcels(agentId){
        for (const parcel of this.parcels){
            if(parcel[1].carriedBy === agentId){
                this.parcels.delete(parcel[0])
            }
        }
    }
    
    updateUncertainty(){
        for (const parcel of this.parcels){
            if(!parcel[1].visible){
                parcel[1].reward *= 0.95
                if(parcel[1].reward < 2){
                    this.parcels.delete(parcel[0])
                }
                parcel[1].reward = Math.floor(parcel[1].reward)
            }
        }
    }

    getMap(){
        return this.parcels
    }
    
    print(){
        console.log('\n///////[PARCEL LIST]///////')
        for (const parcel of this.parcels){
            parcel[1].print();
        }
        console.log('////////////////////////////\n')
    }
}

class You{
    constructor(client, verbose=false){
        this.client = client;
        this.verbose = verbose;
        this.client.onYou(data => {
            this.id = data.id
            this.name = data.name
            this.x = Math.round(data.x)
            this.y = Math.round(data.y)
            this.score = data.score
            if(this.verbose){
                this.print()
            }
        });
    }
    print(){
        console.log('[YOU]\t', this.id, this.name, this.x, this.y, this.score)
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
        this.client.onAgentsSensing(data => {
            this.setAllNonVisible()
            for (const a of data){
                this.add(new Agent(a.id, a.name, Math.round(a.x), Math.round(a.y), a.score))
            }
            if (this.verbose){
                this.print()
            }
        })
    }

    getMap(){
        return this.agents
    }

    print(){
        console.log('\n///////[AGENT LIST]///////')
        for (const agent of this.agents){
            agent[1].print()
        }
        console.log('////////////////////////////\n')
    }

    setAllNonVisible(){
        for (const agent of this.agents){
            agent[1].visible = false
        }
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
}

class GameMap{
    constructor(client, verbose=false){
        this.client = client;
        this.verbose = verbose;
        let x_list = []
        let y_list = []
        let delivery_list = []
        this.client.onTile((x, y, delivery) => {
            x_list.push(x)
            y_list.push(y)
            delivery_list.push(delivery)
        });
        setTimeout(() => {
            this.n_rows = Math.max.apply(null, x_list)+1
            this.n_cols = Math.max.apply(null, y_list)+1
            if (this.verbose){
                console.log('Map size: ', this.n_rows, this.n_cols)
            }
            this.matrix = []
            for (let i = 0; i < this.n_rows; i++){
                this.matrix.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.matrix[i].push(0)
                }
            }
            let index = 0
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if (x_list[index] === i && y_list[index] === j){
                        if(delivery_list[index]){
                            this.matrix[i][j] = 2
                        } else {
                            this.matrix[i][j] = 1
                        }
                        index = index + 1
                    }
                }
            }
            if (this.verbose){
                console.log('Map initialized')
                this.print();
            }
        }, 800)

    }

    print(){
        console.log('\n-------[MAP]-------')
        let out = ''
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                if(this.matrix[row][col] === 0){
                    out += '  '
                } else {
                    out += this.matrix[row][col] + ' '
                }
            }
            out += '\n'
        }
        console.log(out)
        console.log('-------------------\n')
    }

    getMatrix(){
        return this.matrix
    }

    getRows(){
        return this.n_rows
    }

    getCols(){
        return this.n_cols
    }
    
}

export { Parcels, You, Agents, GameMap }