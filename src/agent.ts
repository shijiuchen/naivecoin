import {getSockets,Message,MessageType} from './p2p';
let timeSend;
class Agent {

    public nodeCounts: number;

    public address: string[];//注册矿工地址列表

    // public nodeAdd: string[];
    //
    // public nodeCPU: number[];
    //
    // public nodeMEM: number[];

    // public index: string;

    public nodeResourcesList: Map<string,number[]>;//注册节点资源数组

    public TaskNodeList: Map<string,string[]>;

    public TaskDockerList: Map<string,string>;  //任务标识对应的docker地址

    constructor(nodeCounts: number, address:string[], nodeResourcesList: Map<string,number[]>,TaskNodeList: Map<string,string[]>,TaskDockerList: Map<string,string>){
        this.nodeCounts=nodeCounts;
        this.address=address;
        this.nodeResourcesList=nodeResourcesList;
        // this.nodeAdd=nodeAdd;
        this.TaskNodeList=TaskNodeList;
        // this.index=index;
        // this.nodeCPU=nodeCPU;
        // this.nodeMEM=nodeMEM;
        this.TaskDockerList=TaskDockerList;
    }

    /**
     * 注册资源
     * @param newPeer 新的对等方的IP地址
     * @param cpu     闲置cpu
     * @param mem     闲置内存
     * TODO 每一分钟主动向agent进行注册更新
     */
    public register = (newPeer: string,cpu: string,mem: string): void =>{
        if(!this.address.indexOf(newPeer)){
            this.address.push(newPeer);
        }
        let nodes=[parseInt(cpu),parseInt(mem)];
       this.nodeResourcesList[newPeer]=nodes;
       console.log(this.address);
       console.log("nodeResourcesList="+JSON.stringify(this.nodeResourcesList));
       // console.log(newPeer);
       // console.log(this.nodeResourcesList[newPeer]);
    }

    /**
     * 应用发布商发布计算任务 （目前将任务部署到出了发布者的所有链中其他节点）
     * @param address   应用发布商IP
     * @param taskName   任务标识
     * @param dockerAdd   任务需要的虚拟化容器地址
     * TODO 选节点进行部署
     */
    public deployTask = (addr: string, taskName: string, dockerAdd: string): void=>{
        let nodes: string[]=[];
        this.address.map((s: any) => {
            // console.log(s._socket.remoteAddress);
            // let ip;
            // if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
            //     ip = s._socket.remoteAddress.substr(7)
            // }else{
            //     ip=s._socket.remoteAddress;
            // }
            if(s!=addr){
                nodes.push(s);
             }
        });
         console.log(nodes);
        this.TaskNodeList[taskName]=nodes;
        this.TaskDockerList[taskName]=dockerAdd;
         console.log(this.TaskNodeList);
         console.log(this.TaskDockerList);
    }

    /**
     * 具体用户根据任务发布者提供的任务类型发布具体任务
     * @param address  发布任务的用户IP
     * @param taskName  使用的任务标识
     * @param params   执行需要的参数（可以不需要）
     * @param reqCPU   请求CPU资源(cores）
     * @param reqMEM    请求MEM资源（MB）
     * @param estiTime  预计请求时间(s)
     */
    public schedulerTask = (address: string,taskName: string, params: string, reqCPU: string, reqMEM: string, estiTime: string): void =>{
        timeSend=new Date().getTime();
        console.log("now time= "+timeSend);
        let nodes: string[]=this.TaskNodeList[taskName];
        console.log(nodes);

        //scheduler algorithm
        //预选可以满足要求的节点

        let preResult=nodes.filter(item=>{
            if(this.nodeResourcesList[item][0] >= parseInt(reqCPU) && this.nodeResourcesList[item][1] >= parseInt(reqMEM)){
                return true;
            }else{
                return false;
            }
        });

        console.log("preResult="+preResult);

        //根据CPU、MEM闲置量决定选择调度的节点

        let chosen=0;
        preResult.forEach((item,index)=>{
            if(index!=preResult.length-1){
                let CPU1=this.nodeResourcesList[item][0];
                console.log("CPU1="+CPU1);
                let MEM1=this.nodeResourcesList[item][1];
                console.log("MEM1="+MEM1);
                let CPU2=this.nodeResourcesList[preResult[index+1]][0];
                console.log("CPU2="+CPU2);
                let MEM2=this.nodeResourcesList[preResult[index+1]][1];
                console.log("MEM2="+MEM2);
                if(CPU1 >= CPU2 && MEM1 >= MEM2){
                    chosen=index;
                }else if(CPU1 <= CPU2 && MEM1 <= MEM2){
                    chosen=index+1;
                }else{
                    let param1=parseFloat(CPU1)/parseFloat(MEM1);
                    console.log("param1="+param1);
                    let param2=parseFloat(CPU2)/parseFloat(MEM2);
                    console.log("param2="+param2);
                    let param3=parseFloat(reqCPU)/parseFloat(reqMEM);
                    console.log("param3="+param3);
                    console.log("Math.abs(param1-param3)="+Math.abs(param1-param3));
                    console.log("Math.abs(param2-param3)="+Math.abs(param2-param3));
                    if(Math.abs(param1-param3)<=Math.abs(param2-param3)){
                        chosen=index;
                    }else{
                        chosen=index+1;
                    }
                }
            }
            console.log("chosen="+chosen);
        });

        let index: string=preResult[chosen];
        console.log("chose="+preResult[chosen]);
        // console.log(nodes);
        //scheduling tasks in order
        getSockets().map((s: any) => {
            //console.log(s._socket.remoteAddress);
            let ip = s._socket.remoteAddress;
            if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                ip = s._socket.remoteAddress.substr(7)
            }
            console.log("ip="+ip);
            if(ip==index){
                let information : Message = ({'type': MessageType.GET_PARAM, 'data': address+':'+params});//在message中增加发送请求节点IP
                console.log(information);
                console.log(JSON.stringify(information));
                s.send(JSON.stringify(information));
            }
        });
        //
        // let i: number = 1;
        // for(; i < nodes.length; i++){
        //     if(nodes[i] == index){
        //         break;
        //     }
        // }
        // ++i;
        // if(i >= nodes.length)
        //     i=1;
        // nodes[0] = nodes[i];
        //

    }

}

export {Agent,timeSend};