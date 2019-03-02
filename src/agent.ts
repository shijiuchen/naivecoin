import {broadcastLatest, getSockets, Message, MessageType} from './p2p';
import {getCoinbaseTransaction, Transaction, TxIn, TxOut} from "./transaction";
import {getPublicFromWallet} from "./wallet";
import {getTransactionPool} from "./transactionPool";
import {addBlockToChain, Block, getBlockchain, getDifficulty, getLatestBlock, calculatepouwHash, getCurrentTimestamp} from "./blockchain";
import * as _ from "lodash";
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
     * Done 每30s主动向agent进行注册更新
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
    public schedulerTask = (address: string,taskName: string, params: string, reqCPU: string, reqMEM: string, estiTime: string, money: string): void =>{
        timeSend=new Date().getTime();
        console.log("now time= "+timeSend);

        //TODO 调度前对于交易池进行挖矿打包,现在是直接生成一个区块，并没有挖矿
        const previousBlock: Block = getLatestBlock();
        const nextIndex: number = previousBlock.index + 1;
        const nextTimestamp: number = getCurrentTimestamp();
        const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
        const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
        const hash: string = calculatepouwHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0, "");
        const newBlock: Block = new Block(nextIndex, hash, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0,"");
        if (addBlockToChain(newBlock)) {
            broadcastLatest();
            //return newBlock;
        } else {
            //return null;
        }
        //验证交易锁定情况
        //aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);


        const minedBlock: Block=getLatestBlock();//得到刚刚挖出的块
        const minedTrans: Transaction[]=minedBlock.data;//得到挖出的交易
        const minedTxOuts: TxOut[] = _(minedTrans)  //得到挖出的所有TxOuts
            .map((tx) => tx.txOuts)
            .flatten()
            .value();
        const resTxouts: TxOut=minedTxOuts.find((txout) => txout.LOCK===true && txout.amount===parseInt(money));
        console.log("resTxouts="+resTxouts);
        if(resTxouts!=null){//确实存在这笔锁定的TxOut

            console.log("Going into scheduling!");




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
        //调度到具体矿工节点
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
        }else{
            //Do noting
            //TODO 返回用户相关信息
        }
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

    /**
     * 预估执行任务需要钱数
     * @param reqCPU
     * @param reqMEM
     * @param estiTime
     * TODO 查看现有云平台计算价格
     */
    public estimateUTXO = (reqCPU: string, reqMEM: string, estiTime: string): number =>{
        return parseInt(reqCPU)*parseInt(reqMEM)*parseInt(estiTime)/100;
    }
    /**
     * 对于任务发布者进行UTXO锁定请求
     * @param address
     * @param taskName
     * @param params
     * @param reqCPU
     * @param reqMEM
     * @param estiTime
     */
    public requestUTXOlock = (address: string,taskName: string, params: string, reqCPU: string, reqMEM: string, estiTime: string): void =>{
        //估算价格
        let amount : number=this.estimateUTXO(reqCPU,reqMEM,estiTime);
        console.log("Agent estimate the amount is:"+amount);
        //请求锁定UTXO
        getSockets().map((s: any) => {
            //console.log(s._socket.remoteAddress);
            let ip = s._socket.remoteAddress;
            if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                ip = s._socket.remoteAddress.substr(7)
            }
            console.log("ip="+ip);
            if(ip==address){
                let information : Message = ({'type': MessageType.REQUEST_UTXO_LOCK, 'data': address+":"+taskName+":"+params+":"+reqCPU+":"+reqMEM+":"+estiTime+":"+amount.toString()});//在message中增加发送请求节点IP
                console.log(information);
                console.log(JSON.stringify(information));
                s.send(JSON.stringify(information));
            }
        });
    }

}

export {Agent,timeSend};