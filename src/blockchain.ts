import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';
import {broadcastLatest, broadCastTransactionPool, getSockets, Message, MessageType} from './p2p';
import {
    getCoinbaseTransaction, isValidAddress, processTransactions, Transaction, UnspentTxOut, ec, toHexString
} from './transaction';
import {addToTransactionPool, getTransactionPool, updateTransactionPool} from './transactionPool';
import {hexToBinary} from './util';
import {createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet} from './wallet';
import {readFile, readFileSync} from "fs";
import {All} from "tslint/lib/rules/completedDocsRule";
// import {Message} from "_debugger";

let ncountMap=new Map<string,number>(); //用于记录分布式任务指令计数
let AllRes;
let taskNameFrontend;
let timeBegin;
let timeEnd;
let result_miner;
let exenFrondend;
class Block {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public difficulty: number;
    public nonce: number;
    public pouw: string;

    constructor(index: number, hash: string, previousHash: string,
                timestamp: number, data: Transaction[], difficulty: number, nonce: number, pouw: string) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
        this.pouw=pouw;
    }
}
//创世交易
const genesisTransaction = {
    'txIns': [{'signature': '', 'txOutId': '', 'txOutIndex': 0}],
    'txOuts': [{
        'address': '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
        'amount': 50,
        'LOCK' : false
    }],
    'id': 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3'
};
//创世块
const genesisBlock: Block = new Block(
    0, '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', '', 1465154705, [genesisTransaction], 0, 0, ''
);
//区块链
let blockchain: Block[] = [genesisBlock];

// the unspent txOut of genesis block is set to unspentTxOuts on startup
let unspentTxOuts: UnspentTxOut[] = processTransactions(blockchain[0].data, [], 0);

const getBlockchain = (): Block[] => blockchain;

const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts);

// and txPool should be only updated at the same time
const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
    console.log('replacing unspentTxouts with: %s', newUnspentTxOut);
    unspentTxOuts = newUnspentTxOut;
};

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// in blocks 十个块调整一次难度值
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

//TODO 动态调整难度值没有使用？？？
const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        if(prevAdjustmentBlock.difficulty-1 >= 0){
            return prevAdjustmentBlock.difficulty - 1;
        }else{
            return 0;
        }
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);
/**
 * 生成新的区块
 * @param blockData
 */
const generateRawNextBlock = (blockData: Transaction[]) => {
    const previousBlock: Block = getLatestBlock();
    const difficulty: number = 0;
    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = getCurrentTimestamp();
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty,"");
    if (addBlockToChain(newBlock)) {
        broadcastLatest();
        return newBlock;
    } else {
        return null;
    }
};

/**
 * 延迟函数
 * @param n
 */
function sleep(n)
{
    var  start=new Date().getTime();
    while(true) if(new Date().getTime()-start>n)  break;
}
/**
 * 执行有用功、生成Pouw区块
 * TODO 任务结果返回用户
 * @param blockData
 */
const generatePouwNextBlock = (message: Message ) => {
    //对message做分割处理
    //"2:3:4:5".split(":")	//将返回["2", "3", "4", "5"]
    let information: string[]=message.data.toString().split(":");
    let params: string = information[1];
    let address: string = information[0];
    let taskName: string=information[2];//任务名字
    taskNameFrontend=taskName;

    let pouw = "";
    let result = "";
    let exeN ;
    //任务执行过程
    console.log(message);
    console.log(getDifficulty(getBlockchain()));
    const { exec } = require('child_process');
    console.log("tastname="+taskName);

    timeBegin = new Date().getTime();
    console.log("task begin time= " + timeBegin);

    //进行任务类型判断
    if(taskName === "asylo"){
        console.log("find matrix");
        exec('docker run  --rm \\\n' +
            '    -v bazel-cache:/root/.cache/bazel \\\n' +
            '    -v "/home/syc/asylo-examples":/opt/my-project \\\n' +
            '    -w /opt/my-project \\\n' +
            '    gcr.io/asylo-framework/asylo \\\n' +
            '    bazel run --config=enc-sim //quickstart -- --message="'+getDifficulty(getBlockchain())+'"', (err, stdout, stderr) => {
            console.log("stdout="+stdout);

            timeEnd = new Date().getTime();
            console.log("task end time= " + timeEnd);

            // let returnInf: string[] = stdout.toString().split(';');
            // pouw = returnInf[0];
            //执行任务结果
            result = stdout.toString();
            result_miner=result;
            // ncount = returnInf[2];
            // let runTime = "";
            // runTime = returnInf[3];
            // console.log("pouw= "+pouw);
            console.log("result= "+result);
            // console.log("ncount= "+ncount);
            // console.log("runTime= "+runTime);

            //获取执行的有用功
            //延迟5秒，等待写入文件
            sleep(5000);
            console.log("time out finished!");

            //读取文件，获得有用功
            var fs = require('fs');
            var path="/home/syc/naivecoin/log/result.txt";
            exeN = fs.readFileSync(path, "utf8");
            console.log("exeN="+exeN);

            exenFrondend=exeN;

            //删除有用功记录文件
            fs.truncate('/home/syc/naivecoin/log/result.txt', 0, function(){console.log('done')});

            //判断是否有出块条件
            if(getDifficulty(getBlockchain()) == 0) {

                //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                pouw = toHexString(key.sign(result+";SUCCESS").toDER());
                console.log("pouw"+pouw);

            } else {

                let SRNG1 : number=Math.floor(Math.random()*999+1);
                let SRNG2 : number=1000;
                let EXP : number =  2.718281828;
                let SRNG : number = SRNG1 / SRNG2;
                let parm1 : number = Math.pow(EXP,(exeN/getDifficulty(getBlockchain())));
                let parm2 : number= Math.pow(EXP,-(exeN/getDifficulty(getBlockchain())));
                let Prob : number= (parm1-parm2)/(parm1+parm2);

                if(Prob > SRNG) {

                    //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                    const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                    pouw = toHexString(key.sign(result+";"+exeN+";"+"SUCCESS").toDER());
                    console.log("pouw"+pouw);

                }
                else {

                    pouw = "FAILED";

                }
            }

            //根据pouw判断是否可以生成区块
            if(pouw == "FAILED"){

                //Do nothing

            }
            else {

                //生成coinbase奖励区块，并挖出之前的交易
                const previousBlock: Block = getLatestBlock();
                const nextIndex: number = previousBlock.index + 1;
                const nextTimestamp: number = getCurrentTimestamp();
                const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
                const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
                const hash: string = calculatepouwHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0, pouw);
                const newBlock: Block = new Block(nextIndex, hash, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0,pouw);

                if (addBlockToChain(newBlock)) {

                    broadcastLatest();
                    //return newBlock;

                } else {

                    //return null;

                }

            }

            //任务结果返还给用户，以及执行任务矿工节点的公钥
            getSockets().map((s: any) => {
                //console.log(s._socket.remoteAddress);
                let ip = s._socket.remoteAddress;
                if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                    ip = s._socket.remoteAddress.substr(7)
                }
                if(ip == address){
                    let information : Message = ({'type': MessageType.RESULT, 'data': result+'?'+exeN.toString()+'?'+getPublicFromWallet()});
                    console.log(information);
                    console.log(JSON.stringify(information));
                    s.send(JSON.stringify(information));
                }
            });
        });

    }else if(taskName === "caffe"){
        console.log("find caffe");
        exec('bash /home/syc/naivecoin/start_caffe.sh', (err, stdout, stderr) => {

            timeEnd = new Date().getTime();
            console.log("task end time= " + timeEnd);

            // console.log("stdout="+stdout);
            // let returnInf: string[] = stdout.toString().split(';');
            // pouw = returnInf[0];
            //执行任务结果
            // result = stdout.toString();
            // ncount = returnInf[2];
            // let runTime = "";
            // runTime = returnInf[3];
            // console.log("pouw= "+pouw);
            // console.log("ncount= "+ncount);
            // console.log("runTime= "+runTime);
            //读取文件，获取训练log记录
            var fs = require('fs');
            var resPath="/home/syc/naivecoin/resCaffe.txt";
            result = fs.readFileSync(resPath, "utf8");
            console.log("result= "+result);
            result_miner=result;

            //获取任务执行结果之后，删除记录文件
            fs.truncate('/home/syc/naivecoin/resCaffe.txt', 0, function(){console.log('done')});

            //获取执行的有用功
            //延迟5秒，等待写入文件
            sleep(5000);
            console.log("time out finished!");

            //读取文件，获得有用功
            var path="/home/syc/naivecoin/log/result.txt";
            exeN = fs.readFileSync(path, "utf8");
            console.log("exeN="+exeN);

            exenFrondend=exeN;

            //删除有用功记录文件
            fs.truncate('/home/syc/naivecoin/log/result.txt', 0, function(){console.log('done')});

            //判断是否有出块条件
            if(getDifficulty(getBlockchain()) == 0) {

                //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                pouw = toHexString(key.sign(result+";"+exeN+";"+"SUCCESS").toDER());
                console.log("pouw"+pouw);

            } else {

                let SRNG1 : number=Math.floor(Math.random()*999+1);
                let SRNG2 : number=1000;
                let EXP : number =  2.718281828;
                let SRNG : number = SRNG1 / SRNG2;
                let parm1 : number = Math.pow(EXP,(exeN/getDifficulty(getBlockchain())));
                let parm2 : number= Math.pow(EXP,-(exeN/getDifficulty(getBlockchain())));
                let Prob : number= (parm1-parm2)/(parm1+parm2);

                if(Prob > SRNG) {

                    //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                    const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                    pouw = toHexString(key.sign(result+";SUCCESS").toDER());
                    console.log("pouw"+pouw);

                }
                else {

                    pouw = "FAILED";

                }
            }

            //根据pouw判断是否可以生成区块
            if(pouw == "FAILED"){

                //Do nothing

            }
            else {

                //生成coinbase奖励区块，并挖出之前的交易
                const previousBlock: Block = getLatestBlock();
                const nextIndex: number = previousBlock.index + 1;
                const nextTimestamp: number = getCurrentTimestamp();
                const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
                const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
                const hash: string = calculatepouwHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0, pouw);
                const newBlock: Block = new Block(nextIndex, hash, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0,pouw);

                if (addBlockToChain(newBlock)) {

                    broadcastLatest();
                    //return newBlock;

                } else {

                    //return null;

                }

            }

            //任务结果返还给用户，以及执行任务矿工节点的公钥
            getSockets().map((s: any) => {
                //console.log(s._socket.remoteAddress);
                let ip = s._socket.remoteAddress;
                if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                    ip = s._socket.remoteAddress.substr(7)
                }
                if(ip == address){
                    let information : Message = ({'type': MessageType.RESULT, 'data': result+'?'+exeN.toString()+'?'+getPublicFromWallet()});
                    console.log(information);
                    console.log(JSON.stringify(information));
                    s.send(JSON.stringify(information));
                }
            });
        });

    }else if(taskName === "hadoop"){
        console.log("find hadoop");

        //将用户传递的参数写入file0.txt
        var fs = require('fs');
        var pathin="/home/syc/naivecoin/file0.txt";
        fs.writeFileSync(pathin,params,"utf8");


        exec('bash /home/syc/naivecoin/start_hadoopWordCount.sh', (err, stdout, stderr) => {

            timeEnd = new Date().getTime();
            console.log("task end time= " + timeEnd);

            // console.log("stdout="+stdout);
            // let returnInf: string[] = stdout.toString().split(';');
            // pouw = returnInf[0];
            //执行任务结果
            // result = stdout.toString();
            // ncount = returnInf[2];
            // let runTime = "";
            // runTime = returnInf[3];
            // console.log("pouw= "+pouw);
            // console.log("ncount= "+ncount);
            // console.log("runTime= "+runTime);

            //读取文件，获得总wordcount结果
            var fs = require('fs');
            var resPath="/home/syc/naivecoin/resHadoop.txt";
            AllRes = fs.readFileSync(resPath, "utf8");
            console.log("AllRes= "+AllRes);
            result_miner=AllRes;

            //获取任务执行结果之后，删除记录文件
            fs.truncate('/home/syc/naivecoin/resHadoop.txt', 0, function(){console.log('done')});


            //获取执行的有用功
            //延迟5秒，等待写入文件
            sleep(5000);
            console.log("time out finished!");

            //读取文件，获得有用功
            var path="/home/syc/naivecoin/log/result.txt";
            let  receiver : string[]= fs.readFileSync(path, "utf8").toString().split("\n");
            console.log("receiver="+receiver);

            let sum : number = 0;
            for(let i=0; i < receiver.length-1; i++){
                if(receiver[i].charAt(0)!='.'){
                    sum = sum+parseInt(receiver[i]);
                }else{
                    sum = sum+0;
                }
            }

            exeN=sum.toString();
            console.log("exeN="+exeN);

            //删除有用功记录文件
            fs.truncate('/home/syc/naivecoin/log/result.txt', 0, function(){console.log('done')});

            //判断是否有出块条件
            if(getDifficulty(getBlockchain()) == 0) {

                //模拟使用intel私钥进行签名，签署result+exeN+关键字"SUCCESS"
                const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                pouw = toHexString(key.sign(result+";"+exeN+";"+"SUCCESS").toDER());
                console.log("pouw"+pouw);

            } else {

                let SRNG1 : number=Math.floor(Math.random()*999+1);
                let SRNG2 : number=1000;
                let EXP : number =  2.718281828;
                let SRNG : number = SRNG1 / SRNG2;
                let parm1 : number = Math.pow(EXP,(parseInt(exeN)/getDifficulty(getBlockchain())));
                let parm2 : number= Math.pow(EXP,-(parseInt(exeN)/getDifficulty(getBlockchain())));
                let Prob : number= (parm1-parm2)/(parm1+parm2);

                if(Prob > SRNG) {

                    //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                    const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                    pouw = toHexString(key.sign(result+";"+exeN+";SUCCESS").toDER());
                    console.log("pouw"+pouw);

                }
                else {

                    pouw = "FAILED";

                }
            }

            //根据pouw判断是否可以生成区块
            if(pouw == "FAILED"){

                //Do nothing

            }
            else {

                //生成coinbase奖励区块，并挖出之前的交易
                const previousBlock: Block = getLatestBlock();
                const nextIndex: number = previousBlock.index + 1;
                const nextTimestamp: number = getCurrentTimestamp();
                const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
                const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
                const hash: string = calculatepouwHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0, pouw);
                const newBlock: Block = new Block(nextIndex, hash, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0,pouw);

                if (addBlockToChain(newBlock)) {

                    broadcastLatest();
                    //return newBlock;

                } else {

                    //return null;

                }

            }

            //将master的有用功存入map
            ncountMap[getPublicFromWallet()]=parseInt(exeN);

            //发送消息请求获取指令计数
            getSockets().map((s: any) => {
                //console.log(s._socket.remoteAddress);
                let ip = s._socket.remoteAddress;
                if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                    ip = s._socket.remoteAddress.substr(7)
                }
                if(ip == "192.168.1.119" || ip == "192.168.1.121"){
                    let information : Message = ({'type': MessageType.REQUEST_NCOUNT, 'data': address});
                    console.log(information);
                    console.log(JSON.stringify(information));
                    s.send(JSON.stringify(information));
                    sleep(50000);
                    console.log("REQUEST_NCOUNT finished!");
                }
            });


        });

    }

};

const ReturnAllNcount = (message: Message) => {
    let information: string[]=message.data.toString().split(":");
    ncountMap[information[0]]=parseInt(information[1]);
    console.log("ncountMap="+JSON.stringify(ncountMap));
    console.log("size="+Object.keys(ncountMap).length);
    if(Object.keys(ncountMap).length == 3){

        let keys : string[] = [];
        let values : string[] = [];
        for(var k in ncountMap){

            keys.push(k);
            values.push(ncountMap[k]);

        }
        console.log("keys="+keys);
        console.log("values="+values);
        getSockets().map((s: any) => {
            //console.log(s._socket.remoteAddress);
            let ip = s._socket.remoteAddress;
            if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                ip = s._socket.remoteAddress.substr(7)
            }
            if(ip == information[2].toString()){
                let information : Message = ({'type': MessageType.RESULTAllNODES, 'data': keys[0]+":"+values[0]+":"+
                        keys[1]+":"+values[1]+":"+keys[2]+":"+values[2]+":"+AllRes});
                console.log(information);
                console.log(JSON.stringify(information));
                s.send(JSON.stringify(information));
            }
        });
        //清空记录map
        ncountMap.clear();

    }else{
        return;
    }
};




// gets the unspent transaction outputs owned by the wallet
const getMyUnspentTransactionOutputs = () => {
    return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts());
};

const generateNextBlock = () => {
    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
    return generateRawNextBlock(blockData);
};

const generatenextBlockWithTransaction = (receiverAddress: string, amount: number) => {
    if (!isValidAddress(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }
    const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const tx: Transaction = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool(),false);
    const blockData: Transaction[] = [coinbaseTx, tx];
    return generateRawNextBlock(blockData);
};
/**
 * POW共识挖矿
 * @param index
 * @param previousHash
 * @param timestamp
 * @param data
 * @param difficulty
 * @param pouw
 */
const findBlock = (index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number,pouw: string): Block => {
    let nonce = 0;
    while (true) {
        const hash: string = calculatepouwHash(index, previousHash, timestamp, data, difficulty, nonce, pouw);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce, pouw);
        }
        nonce++;
    }
};

const getAccountBalance = (): number => {
    return getBalance(getPublicFromWallet(), getUnspentTxOuts());
};

const sendTransaction = (address: string, amount: number, isLOCK: boolean): Transaction => {
    const tx: Transaction = createTransaction(address, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool(),isLOCK);
    addToTransactionPool(tx, getUnspentTxOuts());
    broadCastTransactionPool();
    return tx;
};

const calculateHashForBlock = (block: Block): string =>
    calculatepouwHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce, block.pouw);


const calculatepouwHash = (index: number, previousHash: string, timestamp: number, data: Transaction[],
                       difficulty: number, nonce: number,pouw: string): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce+pouw).toString();

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object';
};

const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};
//TODO  时间戳？
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};

const hasValidHash = (block: Block): boolean => {

    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got:' + block.hash);
        return false;
    }

    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
    }
    return true;
};

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block);
    return blockHash === block.hash;
};

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

/*
    Checks if the given blockchain is valid. Return the unspent txOuts if the chain is valid
 */
const isValidChain = (blockchainToValidate: Block[]): UnspentTxOut[] => {
    console.log('isValidChain:');
    console.log(JSON.stringify(blockchainToValidate));
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if (!isValidGenesis(blockchainToValidate[0])) {
        return null;
    }
    /*
    Validate each block in the chain. The block is valid if the block structure is valid
      and the transaction are valid
     */
    let aUnspentTxOuts: UnspentTxOut[] = [];

    for (let i = 0; i < blockchainToValidate.length; i++) {
        const currentBlock: Block = blockchainToValidate[i];
        if (i !== 0 && !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }

        aUnspentTxOuts = processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
        if (aUnspentTxOuts === null) {
            console.log('invalid transactions in blockchain');
            return null;
        }
    }
    return aUnspentTxOuts;
};

const addBlockToChain = (newBlock: Block): boolean => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const retVal: UnspentTxOut[] = processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
        if (retVal === null) {
            console.log('block is not valid in terms of transactions');
            return false;
        } else {
            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            updateTransactionPool(unspentTxOuts);
            return true;
        }
    }
    return false;
};
/**
 * 区块链更新，比较链的总难度值，难度值和最大的即为主链
 * @param newBlocks
 */
const replaceChain = (newBlocks: Block[]) => {
    const aUnspentTxOuts = isValidChain(newBlocks);
    const validChain: boolean = aUnspentTxOuts !== null;
    if (validChain &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        setUnspentTxOuts(aUnspentTxOuts);
        updateTransactionPool(unspentTxOuts);
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
};

const handleReceivedTransaction = (transaction: Transaction) => {
    addToTransactionPool(transaction, getUnspentTxOuts());
};
const getTasknameFrontend = (): string =>{
    let frtaskName: string = taskNameFrontend;
    taskNameFrontend = "";
    return frtaskName;
};
const getBeginTimeExecute = (): string =>{
    let frTime: string = timeBegin;
    timeBegin = "";
    return frTime;
};
const getEndTimeExecute = (): string =>{
    let frTime: string = timeEnd;
    timeEnd = "";
    return frTime;
};
const getresult_miner = (): string =>{
    let frResult: string = result_miner;
    result_miner = "";
    return frResult;
};
const getexenFrontend = (): string =>{
    let frExen: string = exenFrondend;
    exenFrondend = "";
    return frExen;
};
export {
    Block, getBlockchain, getUnspentTxOuts, getLatestBlock, sendTransaction,
    generateRawNextBlock, generateNextBlock, generatenextBlockWithTransaction,
    handleReceivedTransaction, getMyUnspentTransactionOutputs,
    getAccountBalance, isValidBlockStructure, replaceChain, addBlockToChain,getDifficulty,generatePouwNextBlock,calculatepouwHash, getCurrentTimestamp,unspentTxOuts,sleep,ReturnAllNcount,getTasknameFrontend,getBeginTimeExecute,getEndTimeExecute,getresult_miner,getexenFrontend
};
